import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema, Counter, CounterSchema } from '../activities/activity.schema';
import { Attempt, AttemptSchema } from '../attempts/attempt.schema';

/** Registers every collection once so feature modules can inject any model. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Attempt.name, schema: AttemptSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class ModelsModule {}
