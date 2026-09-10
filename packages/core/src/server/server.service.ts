import { Injectable } from '@nestjs/common';

@Injectable()
export class ServerService {
  getHealth(): { status: string; version: string } {
    return { status: 'ok', version: '0.1.0' };
  }
}
