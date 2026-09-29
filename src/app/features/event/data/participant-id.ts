/** Pad short numeric IDs without truncating longer or alphanumeric IDs. */
export function participantId(value: string): string {
  const id = value.trim();
  return /^[0-9]{1,2}$/.test(id) ? id.padStart(3, '0') : id;
}
