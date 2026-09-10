import { Hocuspocus } from '@hocuspocus/server';
import { createCollabRoom } from '@collaflow/collab-core';

export function createCollabServer(): Hocuspocus {
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
