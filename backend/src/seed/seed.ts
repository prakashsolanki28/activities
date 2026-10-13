import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Model } from 'mongoose';
import { activityContentSchema, type ActivityContentInput, type ImageRef } from '@hrrl/shared';
import { AppModule } from '../app.module';
import { ActivitiesService } from '../activities/activities.service';
import { UploadsService } from '../uploads/uploads.service';
import { Activity } from '../activities/activity.schema';
import { Attempt } from '../attempts/attempt.schema';
import { Admin } from '../auth/admin.schema';
import { spotEveryFlag, spotThePhish, treasureHunt } from './content';

const force = process.argv.includes('--force');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  await app.init();
  const activities = app.get(ActivitiesService);
  const uploads = app.get(UploadsService);
  const activityModel = app.get<Model<Activity>>(getModelToken(Activity.name));
  const attemptModel = app.get<Model<Attempt>>(getModelToken(Attempt.name));
  const owner = await app.get<Model<Admin>>(getModelToken(Admin.name)).findOne({ role: 'owner' }).lean();
  if (!owner) throw new Error('No owner account; start the API once so it can create one.');

  const uploaded = new Map<string, ImageRef>();
  const resolveImage = async (img: ImageRef | null | undefined): Promise<ImageRef | null> => {
    if (!img) return null;
    if (!img.url.startsWith('seed:')) return img;
    const file = img.url.slice('seed:'.length);
    if (!uploaded.has(file)) {
      const buffer = await readFile(join(__dirname, 'images', file));
      uploaded.set(file, await uploads.storeImage(buffer, 'image/png', img.alt));
    }
    return { ...uploaded.get(file)!, alt: img.alt ?? '' };
  };

  for (const seed of [spotThePhish, treasureHunt, spotEveryFlag] as (ActivityContentInput & { slug: string })[]) {
    const existing = await activityModel.findOne({ slug: seed.slug });
    if (existing && !force) {
      console.log(`• ${seed.slug} already exists (use --force to replace)`);
      continue;
    }
    if (existing) {
      await attemptModel.deleteMany({ activityId: existing._id });
      await existing.deleteOne();
    }
    const content = activityContentSchema.parse(seed);
    for (const section of content.sections) {
      section.image = await resolveImage(section.image);
      for (const q of section.questions) q.image = await resolveImage(q.image);
    }
    const created = await activities.create({ title: content.title, description: content.description }, String(owner._id));
    await activities.update(created._id, { ...content, slug: seed.slug, version: created.version });
    const published = await activities.publish(created._id, {});
    const count = content.sections.reduce((n, s) => n + s.questions.length, 0);
    console.log(`✓ ${published.code} ${published.title}: ${count} questions, live at /a/${published.slug}`);
  }
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
