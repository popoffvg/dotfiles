---
name: show-types
description: Draw the type design of a package or a change as a lifetime tree with review flags, and each NEW or CHANGED type as a type card. Loaded by the show-me router for "show me the types" and "review the type design".
user-invocable: false
---

# show-types — lifetime tree and type cards

**The big picture is a lifetime tree. A zoom on one type is a type card.** Show the tree before any code for the types exists, so the human changes a type before the review does.

## Lifetime tree

One level per lifetime, longest first: session, then one per entity, then one per operation. The edge between levels names the method that creates the lower type. Plain data types with no methods and no ports go on one `VALUES` line at the end. Do not draw a graph of links: the levels and the `holds:` lines carry them.

```
SESSION — main.go builds one
Installations                                          # installations.go:14
│  new:     NewInstallations(lister, documents, engine, runs, secrets)
│  holds:   lister · installationPorts{engine, documents, runs, secrets, now}
│  methods: List · New · EngineName · WithClock
│
└─ List, New ──creates one per listed installation──▶
   INSTALLATION — one per row on the list
   Installation                                        # installation.go:27
   │  new:     installationPorts.installation(listed, loaded, storedAt, loadErr, rollout)
   │           NewInstallation(engine, loaded, listed, rollout)
   │  data:    Name Phase Cloud Engine LastApply Version   ← the gateway fills these
   │  state:   loaded{Current, Stored} · storedAt · rollout
   │  holds:   installationPorts (shared with the session)
   │  methods: Deploy · RejoinRollout · PlanInstallation · Settings · Rollout
   │
   └─ Deploy ──NewDeployRollout──▶
      ROLLOUT — one per deploy or rejoin
      Rollout                                          # rollout.go:66
         new:     NewDeployRollout(ports, document, identity)
         state:   running{Identity, LeaseExpiresAt} · version · machine
         holds:   RolloutPorts{Engine, Runs, Now, Wait}
         methods: Record · Apply · Rejoin · Close · State

VALUES — no methods, no ports
InstallationSettings{Current, Stored}   RunIdentity   RunningRollout   Plan
```

Mark each type `NEW`, `CHANGED`, or leave it bare when it exists. A proposed type carries no `# path:line`.

**Review flags.** Write one line under the tree for each hit:

- a type with more than one `new:`;
- a type that a lower layer builds half-made (`data:` filled by a gateway, the rest filled later);
- a port that more than one level holds;
- a method with no caller;
- a NEW type that names no invariant and replaces no primitive or existing type.

## Type card

One card per NEW or CHANGED type, in the language's own syntax, with no bodies. Fields first, then methods. Each method names what it calls, what it returns, and who calls it; a method with no `called by` is cut.

```go
type SaveService struct {                         // NEW
    cache *Cache
    store Store
}
func (s *SaveService) Save(c string) SaveResult   // calls → Cache.Get, Store.Write
                                                  // returns → SaveResult
                                                  // called by ← Handler.Post  handler.go:40
```

