export function totalAdded(snapshot) {
  return (snapshot?.module_changes || []).reduce(
    (total, change) => total + (change.added_lines || 0),
    0
  );
}

export function totalDeleted(snapshot) {
  return (snapshot?.module_changes || []).reduce(
    (total, change) => total + (change.deleted_lines || 0),
    0
  );
}
