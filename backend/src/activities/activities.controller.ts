import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { activityCreateSchema, activityUpdateSchema, scheduleSchema, type ActivityUpdate, type ScheduleInput } from '@hrrl/shared';
import { ActivitiesService } from './activities.service';
import { AdminGuard, CurrentAdmin, type AuthedAdmin } from '../auth/auth.guard';
import { ZodPipe } from '../common/zod.pipe';

@Controller('admin/activities')
@UseGuards(AdminGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  list() {
    return this.activities.list();
  }

  @Post()
  create(@Body(new ZodPipe(activityCreateSchema)) body: z.infer<typeof activityCreateSchema>, @CurrentAdmin() admin: AuthedAdmin) {
    return this.activities.create(body, admin.id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.activities.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodPipe(activityUpdateSchema)) body: ActivityUpdate) {
    return this.activities.update(id, body);
  }

  @Get(':id/issues')
  async issues(@Param('id') id: string) {
    const doc = await this.activities.findDoc(id);
    return { issues: this.activities.publishIssues(doc) };
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string, @Body(new ZodPipe(scheduleSchema)) body: ScheduleInput) {
    return this.activities.publish(id, body);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.activities.unpublish(id);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id') id: string) {
    return this.activities.closeNow(id);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  reopen(@Param('id') id: string) {
    return this.activities.reopen(id);
  }

  @Post(':id/results/publish')
  @HttpCode(200)
  publishResults(@Param('id') id: string) {
    return this.activities.setResultsPublished(id, true);
  }

  @Post(':id/results/hide')
  @HttpCode(200)
  hideResults(@Param('id') id: string) {
    return this.activities.setResultsPublished(id, false);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentAdmin() admin: AuthedAdmin) {
    return this.activities.duplicate(id, admin.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.activities.remove(id);
  }
}
