import * as Y from 'yjs';

import type { AwarenessUserInfo } from '../types';

/**
 * awareness 中携带的远端选区（已序列化为字符串，便于 JSON 传输）。
 */
export interface EncodedSelection {
  /** 选区起点（Y.Text 相对位置，base64） */
  anchor: string;
  /** 选区终点（Y.Text 相对位置，base64） */
  head: string;
}

/**
 * 解析后的远端光标（已换算为 Y.Text 绝对偏移）。
 */
export interface RemoteCursor {
  /** Yjs 客户端 ID */
  clientId: number;
  /** 用户信息（名称 / 颜色） */
  user: AwarenessUserInfo;
  /** 选区起点在 Y.Text 中的字符偏移 */
  anchor: number;
  /** 选区终点在 Y.Text 中的字符偏移 */
  head: number;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * 将 Y.Text 的字符偏移编码为可传输的相对位置。
 *
 * 相对位置记录的是「哪一项」，而非「第几个字符」，因此并发插入导致下标漂移时仍能自愈，
 * 这是协同光标不会错位的关键。
 */
export function encodeRelativePosition(yText: Y.Text, index: number): string {
  const rel = Y.createRelativePositionFromTypeIndex(yText, index);
  return toBase64(Y.encodeRelativePosition(rel));
}

/**
 * 将编码后的相对位置解码为当前文档下的绝对偏移。
 * 若该位置已随编辑被移除（超出文档范围），返回 null。
 */
export function decodeOffset(yText: Y.Text, encoded: string): number | null {
  try {
    const rel = Y.decodeRelativePosition(fromBase64(encoded));
    const doc = yText.doc;
    /* c8 ignore next */
    if (!doc) return null;
    const abs = Y.createAbsolutePositionFromRelativePosition(rel, doc);
    /* c8 ignore next */
    if (!abs || abs.type !== yText) return null;
    return abs.index;
  } catch {
    return null;
  }
}

/**
 * 解码远端选区为 Y.Text 绝对偏移。
 */
export function decodeSelection(
  yText: Y.Text,
  selection: EncodedSelection
): { anchor: number; head: number } | null {
  const anchor = decodeOffset(yText, selection.anchor);
  const head = decodeOffset(yText, selection.head);
  if (anchor === null || head === null) return null;
  return { anchor, head };
}
