import { describe, it, expect } from 'vitest';
import { createCollabRoom, setLocalAwarenessUser, getAwarenessUsers } from './index';

describe('collab-core', () => {
  it('creates a collaborative room', () => {
    const room = createCollabRoom('room-1');
    expect(room.roomId).toBe('room-1');
    expect(room.doc).toBeDefined();
    expect(room.awareness).toBeDefined();
    room.doc.destroy();
  });

  it('sets local awareness user', () => {
    const room = createCollabRoom('room-2');
    setLocalAwarenessUser(room.awareness, {
      id: 'u1',
      name: 'Alice',
      color: '#ff0000',
    });
    const users = getAwarenessUsers(room.awareness);
    expect(users.length).toBeGreaterThan(0);
    expect(users[0]?.user?.name).toBe('Alice');
    room.doc.destroy();
  });
});
