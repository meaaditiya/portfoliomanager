/**
 * canRead(subject, ancestors, ctx) -> { allow, reason, at, via }
 *
 * ancestors is the full chain root -> leaf, the target document included as
 * the last element. Pure and synchronous: no database calls, no network,
 * fully unit-testable on its own.
 *
 * Admins bypass everything. Premium unlocks 'private' (paid) content, the
 * same way it always did, but it does NOT unlock a 'locked' folder — an
 * admin-locked folder stays invisible to every non-admin identity, premium
 * included. That distinction is what closes the vault-wide bypass while
 * keeping the premium-tier product behaviour intact.
 */
function canRead(subject, ancestors, ctx = {}) {
  const isAdmin = subject?.isAdmin === true;
  const isPremium = subject?.isPremium === true;
  const subjectId = subject?.id ? String(subject.id) : null;
  const now = ctx.now || new Date();

  if (isAdmin) {
    return { allow: true, via: 'admin' };
  }

  for (const node of ancestors) {
    if (node.accessLevel === 'locked') {
      return { allow: false, reason: 'locked', at: node.name };
    }

    if (node.accessLevel === 'private') {
      if (isPremium) continue;

      const link = ctx.linkId && (node.privateAccessLinks || []).find((l) =>
        l.linkId === ctx.linkId &&
        l.isActive &&
        (!l.expiresAt || l.expiresAt > now) &&
        (!l.maxAccessCount || l.accessCount < l.maxAccessCount)
      );
      if (link) continue;

      const granted = subjectId && (node.grantedUsers || []).some(
        (g) => String(g.userId) === subjectId
      );
      if (granted) continue;

      return { allow: false, reason: 'private', at: node.name };
    }
  }

  let via = 'public';
  if (isPremium) via = 'premium';
  else if (ctx.linkId) via = 'link';
  else if (subjectId) via = 'grantedUser';

  return { allow: true, via };
}

module.exports = { canRead };
