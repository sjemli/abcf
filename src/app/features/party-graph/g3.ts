ngOnInit() {
  const id = this.route.snapshot.paramMap.get('id')!;
  const partyId = Number(id);

  forkJoin({
    rels:     this.http.get<RelationshipsResponse>(
                `/api/v1/parties/${id}/relationships?direction=ALL`),
    accounts: this.http.get<AccountsResponse>(
                `/api/v1/accounts?partyId=${id}&expand=partyRoles,assignments`)
  }).subscribe({
    next: ({ rels, accounts }) => {
      // Guard: data must be an array
      const relData = Array.isArray(rels.data) ? rels.data : [];
      // Guard: accounts data.content must be an array  
      const accData = Array.isArray(accounts.data?.content) 
                        ? accounts.data.content 
                        : [];

      console.log('[Graph] partyId:', partyId);
      console.log('[Graph] relationships count:', relData.length);
      console.log('[Graph] accounts count:', accData.length);
      console.log('[Graph] relationships raw:', relData);

      this.buildGraph(partyId, relData, accData);
    },
    error: e => {
      this.err.set(e?.message ?? 'Failed to load');
      this.loading.set(false);
    }
  });
}

private buildGraph(
  focalPartyId: number,
  rels: ApiRelationship[],
  accounts: ApiAccount[]
): void {
  console.log('[buildGraph] called with', { focalPartyId, relsLen: rels.length, accsLen: accounts.length });

  const nodeMap         = new Map<string, GNode>();
  const roleMap         = new Map<number, Set<string>>();
  const roleIdToPartyId = new Map<number, number>();
  const edges: GEdge[]  = [];

  // ── STEP 1: Always seed focal node as placeholder ──────────────────────
  const focalNid = `p-${focalPartyId}`;
  nodeMap.set(focalNid, {
    id: focalNid, kind: 'party', partyId: focalPartyId,
    label: `Party ${focalPartyId}`, sublabel: '',
    tier: 'firm', lei: '', countryCode: '',
    x: 0, y: 0
  });

  // ── STEP 2: Process relationships — both sides always ─────────────────
  for (const r of rels) {
    console.log('[buildGraph] processing rel id:', r.id,
      'from:', r.fromPartyRole?.party?.id,
      'to:',   r.toPartyRole?.party?.id);

    const sides = [
      { partyRoleId: r.fromPartyRole.id, party: r.fromPartyRole.party, roleType: r.fromPartyRole.roleType },
      { partyRoleId: r.toPartyRole.id,   party: r.toPartyRole.party,   roleType: r.toPartyRole.roleType   },
    ];

    for (const { partyRoleId, party, roleType } of sides) {
      const nid = `p-${party.id}`;

      // Register partyRoleId → partyId for account edge resolution
      roleIdToPartyId.set(partyRoleId, party.id);

      // Accumulate roles
      if (!roleMap.has(party.id)) roleMap.set(party.id, new Set());
      roleMap.get(party.id)!.add(roleType.name);

      // Upsert node (always overwrite placeholder with real data)
      const existing = nodeMap.get(nid);
      if (!existing || existing.label.startsWith('Party ')) {
        nodeMap.set(nid, {
          id: nid, kind: 'party', partyId: party.id,
          label: party.name, sublabel: '',
          tier: roleToTier(roleType.code),
          lei: party.lei, countryCode: party.countryCode,
          x: 0, y: 0
        });
      }
    }

    // Relationship edge
    edges.push({
      id:    `e-${r.id}`,
      from:  `p-${r.fromPartyRole.party.id}`,
      to:    `p-${r.toPartyRole.party.id}`,
      label: humanLabel(r.rule.relationshipTypeName),
      type:  ruleToEdgeType(r.rule.relationshipTypeName),
      agreementCode: r.agreement?.code
    });
  }

  // Attach role strings to all party nodes
  nodeMap.forEach(n => {
    if (n.kind === 'party' && n.partyId != null) {
      const roles = roleMap.get(n.partyId);
      if (roles?.size) n.sublabel = [...roles].join(', ');
    }
  });

  console.log('[buildGraph] nodeMap after rels:', [...nodeMap.keys()]);
  console.log('[buildGraph] roleIdToPartyId:', [...roleIdToPartyId.entries()]);

  // ── STEP 3: Account nodes + edges ─────────────────────────────────────
  for (const acc of accounts) {
    const anid = `acc-${acc.id}`;

    nodeMap.set(anid, {
      id: anid, kind: 'account',
      accountCode: acc.code,
      label: acc.code,
      sublabel: `${humanLabel(acc.accountTypeCode)} · ${acc.currencyCode}`,
      tier: 'client',
      currency: acc.currencyCode,
      accountType: humanLabel(acc.accountTypeCode),
      status: acc.status,
      x: 0, y: 0
    });

    for (const assignment of acc.assignmentsFull) {
      const ownerPartyId = roleIdToPartyId.get(assignment.partyRoleId) ?? focalPartyId;
      const fromNodeId   = `p-${ownerPartyId}`;

      console.log('[buildGraph] account', acc.code,
        'assignment.partyRoleId:', assignment.partyRoleId,
        '→ ownerPartyId:', ownerPartyId,
        '→ fromNode:', fromNodeId);

      // Enrich focal placeholder from partyRolesFull if still unresolved
      const matchedRole = acc.partyRolesFull.find(pr => pr.id === assignment.partyRoleId);
      const focalNode   = nodeMap.get(focalNid);
      if (matchedRole && focalNode?.label.startsWith('Party ')) {
        focalNode.tier     = roleToTier(matchedRole.roleTypeCode);
        focalNode.sublabel = matchedRole.roleTypeName;
      }

      edges.push({
        id:    `e-acc-${assignment.id}`,
        from:  fromNodeId,
        to:    anid,
        label: matchedRole?.roleTypeName ?? 'Account',
        type:  'account'
      });
    }
  }

  // ── STEP 4: Layout + commit ────────────────────────────────────────────
  const allNodes = [...nodeMap.values()];
  console.log('[buildGraph] final nodes:', allNodes.map(n => n.id));
  console.log('[buildGraph] final edges:', edges.map(e => `${e.from}→${e.to}`));

  assignPositions(allNodes);

  this.focalName.set(nodeMap.get(focalNid)?.label ?? '');
  this.focalNodeId.set(focalNid);
  this.nodes.set(allNodes);
  this.edges.set(edges);
  this.loading.set(false);
}
