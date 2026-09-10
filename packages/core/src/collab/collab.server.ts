import { Hocuspocus } from '@hocuspocus/server';
import { createCollabRoom } from '@collaflow/collab-core';

type CollabDoc = ReturnType<typeof createCollabRoom>['doc'];

/**
 * 文档缓存。
 *
 * MVP 阶段还没有持久化（Prisma Room 表暂未接入），
 * 但至少要按 documentName 复用同一个 Y.Doc，
 * 否则每次加载/重连都会返回一个全新的空文档，内容直接丢失。
 */
const documents = new Map<string, CollabDoc>();

export function createCollabServer(): Hocuspocus {
  return new Hocuspocus({
    name: 'collaflow',
    async onLoadDocument({ documentName }) {
      let doc = documents.get(documentName);

      if (!doc) {
        doc = createCollabRoom(documentName).doc;
        documents.set(documentName, doc);
      }

      return doc;
    },
    async onConnect() {
      // Allow all connections by default.
    },
  });
}
