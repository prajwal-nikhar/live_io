import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class WsValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    let payload = value;
    if (typeof value === 'string') {
      try {
        payload = JSON.parse(value);
      } catch {
        throw new Error('Validation failed: Malformed JSON payload');
      }
    }

    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Validation failed: Payload must be a non-null object');
    }

    const object = plainToInstance(metatype, payload);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const errorMessages = errors
        .map((err) => Object.values(err.constraints || {}).join(', '))
        .join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
