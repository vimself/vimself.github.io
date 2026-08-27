import type { ImageMetadata } from 'astro';

/**
 * 头像资源的可选解析。
 *
 * 用 import.meta.glob 而不是直接 import：直接 import 一个不存在的文件会让整个构建炸掉，
 * 而这个仓库在你把头像放进来之前也应该能正常构建。glob 匹配不到就返回空对象，
 * 此时回落到 public/avatar.svg 的占位图。
 *
 * 放进 src/assets/ 而不是 public/，是为了走 Astro 的图片优化：
 * 一张 1080px 的原图，页头只要 30px、关于页 88px、favicon 64px ——
 * 由 sharp 在构建时各生成一份，而不是每个页面都下载整张原图。
 */
const found = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/avatar.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

export const avatarAsset: ImageMetadata | null = Object.values(found)[0]?.default ?? null;

/** 头像还没放进来时的占位 */
export const AVATAR_FALLBACK = '/avatar.svg';
