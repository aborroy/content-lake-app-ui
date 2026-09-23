/**
 * How a content source is drawn and named.
 *
 * Alfresco and Nuxeo have a colour and an icon of their own; every other source type gets a neutral
 * treatment rather than borrowing one of theirs. The helpers return a *modifier* ('alfresco', 'nuxeo',
 * 'generic') and each component composes its own class prefix from it, so a component's CSS stays local
 * while the decision of which sources are styled lives in one place.
 */

export type SourceModifier = 'alfresco' | 'nuxeo' | 'sharepoint' | 'generic';

/** Source types with dedicated styling. Everything else is 'generic'. */
const STYLED_TYPES: readonly string[] = ['alfresco', 'nuxeo', 'sharepoint'];

/** Icons per styled type, plus the neutral default. */
const ICONS: Record<string, string> = {
  alfresco: 'storage',
  nuxeo: 'folder_open',
  sharepoint: 'cloud'
};

const GENERIC_ICON = 'description';

/**
 * Display names for source types we know by name. Anything absent is de-slugged from the type itself,
 * which reads better than a `titlecase` of the raw value: 'sample-directory' becomes
 * 'Sample Directory' rather than 'Sample-directory'.
 */
const TYPE_LABELS: Record<string, string> = {
  alfresco: 'Alfresco',
  nuxeo: 'Nuxeo',
  filesystem: 'Filesystem',
  cmis: 'CMIS',
  sharepoint: 'SharePoint'
};

export function sourceModifier(sourceType?: string): SourceModifier {
  const type = normalizeType(sourceType);
  return STYLED_TYPES.includes(type) ? (type as SourceModifier) : 'generic';
}

/** Material icon name for a source type. */
export function sourceIcon(sourceType?: string): string {
  return ICONS[normalizeType(sourceType)] ?? GENERIC_ICON;
}

/** `<prefix>-alfresco` / `-nuxeo` / `-generic`, for composing a component's own class names. */
export function sourceClass(prefix: string, sourceType?: string): string {
  return `${prefix}-${sourceModifier(sourceType)}`;
}

/** Readable name for a source type, whether or not this build has heard of it. */
export function sourceTypeLabel(sourceType?: string): string {
  const type = normalizeType(sourceType);
  if (!type) return 'Unknown source';
  return TYPE_LABELS[type] ?? deslug(type);
}

/**
 * Splits a stored `cin_sourceId` value. The type is everything before the first colon; the id keeps any
 * further colons, since only the first separates the two.
 */
export function splitSourceKey(key: string): { sourceType: string; sourceId: string } {
  const idx = (key ?? '').indexOf(':');
  if (idx < 0) return { sourceType: normalizeType(key), sourceId: '' };
  return { sourceType: normalizeType(key.slice(0, idx)), sourceId: key.slice(idx + 1) };
}

/**
 * Label for one `<sourceType>:<sourceId>` key. The id is what distinguishes two sources of the same
 * type, so it is shown when there is one: two CMIS repositories are both "CMIS".
 */
export function sourceKeyLabel(key?: string): string {
  if (!key) return 'Unknown source';
  const { sourceType, sourceId } = splitSourceKey(key);
  const label = sourceTypeLabel(sourceType);
  return sourceId ? `${label} (${sourceId})` : label;
}

function normalizeType(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function deslug(type: string): string {
  return type
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
