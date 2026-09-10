import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface AwarenessState {
  user?: CollabUser;
  cursor?: unknown;
  selection?: unknown;
}

export interface CollabRoom {
  roomId: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
}

export function createCollabRoom(roomId: string): CollabRoom {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  return { roomId, doc, awareness };
}

export function setLocalAwarenessUser(
  awareness: awarenessProtocol.Awareness,
  user: CollabUser,
): void {
  awareness.setLocalStateField('user', user);
}

export function getAwarenessUsers(
  awareness: awarenessProtocol.Awareness,
): AwarenessState[] {
  const states = awareness.getStates();
  const result: AwarenessState[] = [];
  states.forEach((state: unknown) => {
    result.push(state as AwarenessState);
  });
  return result;
}

export { Y, awarenessProtocol };
