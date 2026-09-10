import { Injectable } from '@nestjs/common';
import { Hocuspocus } from '@hocuspocus/server';
import { createCollabRoom } from '@collaflow/collab-core';

@Injectable()
export class CollabService {
  createServer(): Hocuspocus {
    return new Hocuspocus({
      name: 'collaflow',
      async onLoadDocument({ documentName }) {
        return createCollabRoom(documentName).doc;
      },
      async onConnect() {
        // Allow all connections by default.
      },
    });
  }
}
