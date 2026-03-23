let _cancelled = false;

export function setRecordCancelled(): void {
  _cancelled = true;
}

export function popRecordCancelled(): boolean {
  const v = _cancelled;
  _cancelled = false;
  return v;
}
