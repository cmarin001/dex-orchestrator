# TradeKeel frontend–backend contract

**Phase B approved.** Validate against frontend main at `84ccb725c56ad62ad9ef2a05966ca98e8e40a64c` and the adapter branch at `27a4b942b8c6fdd3247ad2f8b42a5f5226d16c27`. Re-run the orphan check whenever the adapter head moves. The adapter-only data-source toggle and two palette commands are client-only (browser preference); its three chart bindings and quote preview reuse existing matrix entries.

Frontend baseline [main at 84ccb72](https://github.com/cmarin001/dex-orchestrator-app/commit/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c). Prior inventory and wire shapes from [backend PR #17 at 624e3de](https://github.com/cmarin001/dex-orchestrator/blob/624e3de793c5c2abcf34d18e1ae3afeeedd4b559/docs/frontend-api-contract.md). The current frontend main branch is a local paper desk. The [adapter draft](https://github.com/cmarin001/dex-orchestrator-app/pull/1) is a separate, unmerged delta. It makes the Overview equity chart and Performance equity/drawdown charts read `GET /api/v1/equity` in Backend mode and sends quote previews to `POST /api/v1/quote`. It has no manual-submit or other command integration.

265 action rows, 115 read rows, 41 traced endpoint IDs and 207 client-only rows. Repeating list elements use one row per rendered template. Shared reads can serve multiple values and pages. Routes, local preferences, dialog state, client-side projections, and exports of already loaded data can stay in the browser.

## Table 1 — Interactive elements

| # | Page | Component | Label | Handler | Current target | Verb / endpoint | Receipt | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-001 | all | [shell.tsx:187](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L187) | Menu | setNav(true), mobile navigation | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-002 | all | [shell.tsx:190](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L190) | Cycle pulse | Link to /live | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-003 | all | [shell.tsx:194](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L194) | Operating mode | Link to /controls | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-004 | all | [shell.tsx:197](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L197) | Arm status | Link to /controls | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-005 | all | [shell.tsx:200](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L200) | Entry status | Link to /controls | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-006 | all | [shell.tsx:203](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L203) | Exposure | Link to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-007 | all | [shell.tsx:206](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L206) | Daily PnL | Link to /performance | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-008 | all | [shell.tsx:211](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L211) | Search / command palette | setPaletteOpen(true) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-009 | all | [shell.tsx:218](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L218) | Notifications | Toggle bell panel | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-010 | all | [shell.tsx:224](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L224) | Notification row | dismissNotice(id), drops local notice | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-011 | all | [shell.tsx:234](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L234) | Kill switch | setKillOpen(true) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-012 | all | [shell.tsx:278](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L278) | Mobile menu backdrop | setNavOpen(false) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-013 | all | [shell.tsx:279](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L279) | Mobile menu interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-014 | all | [shell.tsx:282](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L282) | Close | setNavOpen(false) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-015 | all | [shell.tsx:287](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L287) | Open palette | Close menu, open palette | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-016 | all | [shell.tsx:323](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L323) | Kill dialog backdrop | setKillOpen(false) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-017 | all | [shell.tsx:324](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L324) | Kill dialog interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-018 | all | [shell.tsx:330](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L330) | Pause entries only | kill(false) pauses entries AND disarms live locally | store action — see handler | POST /api/v1/controls/kill-switch | yes | legacy-only |
| ACT-019 | all | [shell.tsx:333](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L333) | Full stop | setFull(true), reveals typed input | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-020 | all | [shell.tsx:350](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L350) | Type KILL | setWord | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-021 | all | [shell.tsx:340](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L340) | Flatten and stop | kill(true), also closes simulated positions; button at line 352 | store action — see handler | POST /api/v1/controls/kill-switch | yes | legacy-only |
| ACT-022 | all | [shell.tsx:378](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L378) | Shortcut help backdrop | setHelpOpen(false) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-023 | all | [shell.tsx:379](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L379) | Shortcut help interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-024 | all | [shell.tsx:93](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L93) | Ctrl/Cmd+K | Open palette | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-025 | all | [shell.tsx:98](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L98) | Ctrl/Cmd+Shift+K | Open kill dialog | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-026 | all | [shell.tsx:104](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L104) | Escape | Close palette, kill, help and navigation | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-027 | all | [shell.tsx:112](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L112) | ? | Open shortcut help | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-028 | all | [shell.tsx:116](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L116) | Space | Toggle local entries state | store action — see handler | POST /api/v1/controls/pause / POST /api/v1/controls/resume | yes | legacy-only |
| ACT-029 | all | [shell.tsx:123](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L123) | E | Click current export button | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-030 | all | [shell.tsx:139](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L139) | G | Start navigation chord | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-031 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | / | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-032 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | / | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-033 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | / | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-034 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /live | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-035 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /live | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-036 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /live | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-037 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /positions | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-038 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /positions | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-039 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /positions | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-040 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /performance | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-041 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /performance | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-042 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /performance | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-043 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /trades | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-044 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /trades | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-045 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /trades | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-046 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /funnel | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-047 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /funnel | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-048 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /funnel | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-049 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /controls | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-050 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /controls | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-051 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /controls | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-052 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /strategies | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-053 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /strategies | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-054 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /strategies | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-055 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /chains | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-056 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /chains | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-057 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /chains | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-058 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /providers | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-059 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /providers | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-060 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /providers | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-061 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /manual-trade | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-062 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /manual-trade | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-063 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /manual-trade | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-064 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /audit | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-065 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /audit | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-066 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /audit | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-067 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /system | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-068 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /system | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-069 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /system | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-070 | all | [shell.tsx:256](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L256) | /settings | Navigate; sidebar visibility depends on desk mode | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-071 | all | [shell.tsx:292](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L292) | /settings | Navigate and close mobile menu | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-072 | all | [palette.tsx:86](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L86) | /settings | Close palette and navigate | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-073 | all | [shell.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L128) | G then O | Navigate to / | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-074 | all | [shell.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L128) | G then L | Navigate to /live | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-075 | all | [shell.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L128) | G then P | Navigate to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-076 | all | [shell.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L128) | G then C | Navigate to /controls | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-077 | all | [shell.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L128) | G then S | Navigate to /strategies | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-078 | all | [shell.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L128) | G then A | Navigate to /audit | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-079 | all | [palette.tsx:47](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L47) | Palette dismissal | setOpen | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-080 | all | [palette.tsx:52](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L52) | Command search | cmdk filters local items | browser handler — see handler | none | no | legacy-only — client-only, filter already loaded rows |
| ACT-081 | all | [palette.tsx:60](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L60) | Kill switch | Open kill dialog | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-082 | all | [palette.tsx:61](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L61) | Pause entries | pauseEntries | store action — see handler | POST /api/v1/controls/pause | yes | legacy-only |
| ACT-083 | all | [palette.tsx:62](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L62) | Resume entries | resumeEntries | store action — see handler | POST /api/v1/controls/resume | yes | legacy-only |
| ACT-084 | all | [palette.tsx:63](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L63) | Arm live | Navigate to /controls | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-085 | all | [palette.tsx:64](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L64) | Disarm live | disarmLive | store action — see handler | POST /api/v1/controls/live-execution | yes | legacy-only |
| ACT-086 | all | [palette.tsx:65](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L65) | Flatten all | Open kill dialog | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-087 | all | [palette.tsx:66](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L66) | Pause exits | setExits(false) | store action — see handler | POST /api/v1/controls/exits/pause | yes | legacy-only |
| ACT-088 | all | [palette.tsx:67](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L67) | Resume exits | setExits(true) | store action — see handler | POST /api/v1/controls/exits/resume | yes | legacy-only |
| ACT-089 | all | [palette.tsx:68](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L68) | Set mode strategies | setMode(strategies) | store action — see handler | POST /api/v1/mode | yes | legacy-only |
| ACT-090 | all | [palette.tsx:69](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L69) | Set mode ai | setMode(ai) | store action — see handler | POST /api/v1/mode | yes | legacy-only |
| ACT-091 | all | [palette.tsx:70](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L70) | Set mode hybrid | setMode(hybrid) | store action — see handler | POST /api/v1/mode | yes | legacy-only |
| ACT-092 | all | [palette.tsx:71](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L71) | Set mode human | setMode(human) | store action — see handler | POST /api/v1/mode | yes | legacy-only |
| ACT-093 | all | [palette.tsx:72](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L72) | Set theme dark | setTheme | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-094 | all | [palette.tsx:73](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L73) | Set theme light | setTheme | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-095 | all | [palette.tsx:74](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L74) | Set locale English | setLocale | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-096 | all | [palette.tsx:75](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L75) | Set locale Español | setLocale | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-097 | all | [palette.tsx:76](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L76) | Set expert view | setViewMode | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-098 | all | [palette.tsx:77](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L77) | Set simple view | setViewMode | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-099 | all | [palette.tsx:78](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L78) | Reset circuit breaker | resetBreaker | store action — see handler | POST /api/v1/controls/circuit-breaker/reset | yes | legacy-only |
| ACT-100 | all | [palette.tsx:79](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L79) | Shortcut help | Open help | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-101 | all | [palette.tsx:80](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L80) | Export audit | Navigate to /audit | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-102 | all | [palette.tsx:81](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L81) | Export positions | Navigate to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-103 | all | [palette.tsx:82](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L82) | Export trades | Navigate to /trades | browser handler — see handler | GET /api/v1/trades/export | no | legacy-only |
| ACT-104 | all | [palette.tsx:93](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L93) | Position item, per position | Navigate to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-105 | all | [palette.tsx:97](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L97) | No open positions | Navigate to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-106 | all | [palette.tsx:103](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L103) | Toggle strategy, per strategy | toggleStrategy(id) | store action — see handler | POST /api/v1/strategies/:id/enable / POST /api/v1/strategies/:id/disable | yes | legacy-only |
| ACT-107 | all | [palette.tsx:111](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L111) | Toggle chain, per chain | toggleChain(id) | store action — see handler | POST /api/v1/controls/chain | yes | legacy-only |
| ACT-108 | / | [pages/overview.tsx:30](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L30) | Daily PnL | Link to /performance | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-109 | / | [pages/overview.tsx:47](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L47) | Unrealized | Link to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-110 | / | [pages/overview.tsx:48](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L48) | Exposure | Link to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-111 | / | [pages/overview.tsx:49](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L49) | Open | Link to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-112 | / | [pages/overview.tsx:64](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L64) | Open position row | Link to /positions | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-113 | / | [pages/overview.tsx:75](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L75) | Audit row | Link to /audit | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-114 | / | [pages/overview.tsx:83](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L83) | Drawdown | Link to /performance | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-115 | / | [pages/overview.tsx:84](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L84) | Last cycle | Link to /live | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-116 | / | [pages/overview.tsx:85](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L85) | Daily PnL KPI | Link to /performance | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-117 | /live | [pages/markets.tsx:23](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L23) | Freeze / unfreeze | setFrozen captures or releases current local events | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-118 | /live | [pages/markets.tsx:39](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L39) | Agent filter pills | setAgent filters local rows | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-119 | /positions | [pages/markets.tsx:77](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L77) | Chain filter pills | setChain filters local rows | browser handler — see handler | none | no | legacy-only — client-only, filter already loaded rows |
| ACT-120 | /positions | [pages/markets.tsx:93](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L93) | Position row | setOpenId opens local details | browser handler — see handler | GET /api/v1/positions/:id | no | legacy-only |
| ACT-121 | /positions | [pages/markets.tsx:114](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L114) | Drawer backdrop | setOpenId(null) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-122 | /positions | [pages/markets.tsx:115](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L115) | Drawer interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-123 | /positions | [pages/markets.tsx:121](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L121) | Close | setOpenId(null) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-124 | /positions | [pages/markets.tsx:154](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L154) | Exit position | setConfirmId opens dialog | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-125 | /positions | [pages/markets.tsx:167](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L167) | Confirm exit | exitPosition(id), removes local position and creates paper fill | store action — see handler | POST /api/v1/controls/exit | yes | legacy-only |
| ACT-126 | /performance | [pages/analysis.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L35) | Equity | Link to overview | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-127 | /performance | [pages/analysis.tsx:36](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L36) | Win rate | Link to trades | browser handler — see handler | none | no | legacy-only — client-only, navigation or keyboard dispatch |
| ACT-128 | /trades | [pages/analysis.tsx:105](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L105) | Token or strategy | setQ filters fixture/session trades | fixture | GET /api/v1/trades | no | legacy-only |
| ACT-129 | /trades | [pages/analysis.tsx:113](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L113) | Trade row | setOpen opens local drawer | browser handler — see handler | GET /api/v1/trades/:id | no | legacy-only |
| ACT-130 | /trades | [pages/analysis.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L128) | Drawer backdrop | setOpen(null) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-131 | /trades | [pages/analysis.tsx:129](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L129) | Drawer interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-132 | /trades | [pages/analysis.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L134) | Close | setOpen(null) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-133 | /controls | [pages/control.tsx:28](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L28) | Arm / Disarm | setGate opens confirmation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-134 | /controls | [pages/control.tsx:34](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L34) | Pause / resume entries | Calls pauseEntries or resumeEntries | store action — see handler | POST /api/v1/controls/pause / POST /api/v1/controls/resume | yes | legacy-only |
| ACT-135 | /controls | [pages/control.tsx:40](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L40) | Pause / resume exits | setGate opens confirmation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-136 | /controls | [pages/control.tsx:45](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L45) | Flatten all | setGate opens confirmation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-137 | /controls | [pages/control.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L54) | Operating mode buttons | setDraftMode and open confirmation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-138 | /controls | [pages/control.tsx:61](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L61) | Max risk % / trade | Edit draft maxRiskPct | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-139 | /controls | [pages/control.tsx:62](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L62) | Max depth % | Edit draft maxDepthPct | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-140 | /controls | [pages/control.tsx:63](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L63) | Slippage bps | Edit draft slippageBps | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-141 | /controls | [pages/control.tsx:64](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L64) | Daily limit USD | Edit draft dailyLimit | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-142 | /controls | [pages/control.tsx:65](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L65) | Per trade USD | Edit draft perTrade | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-143 | /controls | [pages/control.tsx:66](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L66) | Save risk | Open confirmation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-144 | /controls | [pages/control.tsx:74](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L74) | Reset | resetBreaker clears simulated breaker | store action — see handler | POST /api/v1/controls/circuit-breaker/reset | yes | legacy-only |
| ACT-145 | /controls | [pages/control.tsx:88](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L88) | Arm | armLive sets local armed flag | store action — see handler | POST /api/v1/controls/live-execution | yes | legacy-only |
| ACT-146 | /controls | [pages/control.tsx:89](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L89) | Disarm | disarmLive clears local armed flag | store action — see handler | POST /api/v1/controls/live-execution | yes | legacy-only |
| ACT-147 | /controls | [pages/control.tsx:90](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L90) | Save | saveRisk merges local draft | store action — see handler | POST /api/v1/controls/risk / POST /api/v1/controls/trading-limits | yes | legacy-only |
| ACT-148 | /controls | [pages/control.tsx:91](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L91) | Switch | setMode updates local mode | store action — see handler | POST /api/v1/mode | yes | legacy-only |
| ACT-149 | /controls | [pages/control.tsx:92](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L92) | Flatten | flattenAll calls kill(true) | store action — see handler | POST /api/v1/controls/kill-switch | yes | legacy-only |
| ACT-150 | /controls | [pages/control.tsx:93](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L93) | Pause / Resume exits | setExits flips local flag | store action — see handler | POST /api/v1/controls/exits/pause / POST /api/v1/controls/exits/resume | yes | legacy-only |
| ACT-151 | /strategies | [pages/control.tsx:120](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L120) | Search strategy | setQ filters local seeds | browser handler — see handler | none | no | legacy-only — client-only, filter already loaded rows |
| ACT-152 | /strategies | [pages/control.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L128) | Strategy row | setOpen opens details | browser handler — see handler | GET /api/v1/strategies/:id | no | legacy-only |
| ACT-153 | /strategies | [pages/control.tsx:129](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L129) | Toggle strategy checkbox | toggleStrategy; click propagation suppressed | store action — see handler | POST /api/v1/strategies/:id/enable / POST /api/v1/strategies/:id/disable | yes | legacy-only |
| ACT-154 | /strategies | [pages/control.tsx:146](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L146) | Lookback | On blur updateStrategyParam(id, lookback, number) | store action — see handler | POST /api/v1/strategies/:id/params | yes | legacy-only |
| ACT-155 | /strategies | [pages/control.tsx:148](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L148) | Close | setOpen(null) | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-156 | /chains | [pages/control.tsx:169](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L169) | Enable / Disable | toggleChain updates local flag | store action — see handler | POST /api/v1/controls/chain | yes | legacy-only |
| ACT-157 | /chains | [pages/control.tsx:181](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L181) | Capital allocation slider | setAlloc edits draft | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-158 | /chains | [pages/control.tsx:186](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L186) | Save allocations | Opens dialog if sum is at most 100 | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-159 | /chains | [pages/control.tsx:190](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L190) | Save | setAllocations updates local capital percentages | store action — see handler | POST /api/v1/controls/chain | yes | legacy-only |
| ACT-160 | /providers | [pages/control.tsx:215](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L215) | Enable / Disable | toggleProvider updates local flag | store action — see handler | POST /api/v1/providers/:id/enable / POST /api/v1/providers/:id/disable | yes | legacy-only |
| ACT-161 | /providers | [pages/control.tsx:216](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L216) | Up | moveProvider moves a local item up | store action — see handler | POST /api/v1/controls/providers/order | yes | legacy-only |
| ACT-162 | /providers | [pages/control.tsx:217](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L217) | Down | moveProvider moves a local item down | store action — see handler | POST /api/v1/controls/providers/order | yes | legacy-only |
| ACT-163 | /manual-trade | [pages/control.tsx:252](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L252) | Token | setToken edits draft | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-164 | /manual-trade | [pages/control.tsx:255](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L255) | Side | setSide edits draft | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-165 | /manual-trade | [pages/control.tsx:261](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L261) | Size | setSize edits draft | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-166 | /manual-trade | [pages/control.tsx:264](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L264) | Slippage | setSlip edits draft | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-167 | /manual-trade | [pages/control.tsx:267](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L267) | Chain | setChain edits draft | browser handler — see handler | none | no | legacy-only — client-only, filter already loaded rows |
| ACT-168 | /manual-trade | [pages/control.tsx:274](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L274) | MEV cards | setMev relays/deadline/bundle/none selection | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-169 | /manual-trade | [pages/control.tsx:282](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L282) | Preview quote | previewQuote computes impact and minimum output with fixed liquidity | store action — see handler | POST /api/v1/quote | no | legacy-only |
| ACT-170 | /manual-trade | [pages/control.tsx:283](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L283) | Submit manual trade | setGate opens confirmation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-171 | /manual-trade | [pages/control.tsx:287](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L287) | Submit | submitManual writes paper position or routes to local exit | store action — see handler | POST /api/v1/controls/manual-trade | yes | legacy-only |
| ACT-172 | /audit | [pages/system.tsx:25](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L25) | JSONL | Download filtered local events | browser handler — see handler | GET /api/v1/audit/export | no | legacy-only |
| ACT-173 | /audit | [pages/system.tsx:32](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L32) | Search or run id | setQ filters local events | browser handler — see handler | GET /api/v1/audit | no | legacy-only |
| ACT-174 | /audit | [pages/system.tsx:33](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L33) | Agent filter | setAgent filters local events | browser handler — see handler | GET /api/v1/audit | no | legacy-only |
| ACT-175 | /audit | [pages/system.tsx:40](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L40) | Audit row / detail | setOpen toggles local JSON | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-176 | /system | [pages/system.tsx:63](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L63) | Diagnostic | Download paper status and last 20 local events | browser handler — see handler | GET /api/v1/system/diagnostics | no | legacy-only |
| ACT-177 | /settings | [pages/system.tsx:112](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L112) | Dark | setTheme persists browser preference | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-178 | /settings | [pages/system.tsx:113](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L113) | Light | setTheme persists browser preference | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-179 | /settings | [pages/system.tsx:114](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L114) | Density | setDensity persists browser preference | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-180 | /settings | [pages/system.tsx:117](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L117) | Simple / Expert | setViewMode persists browser preference | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-181 | /settings | [pages/system.tsx:124](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L124) | English | setLocale persists browser preference | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-182 | /settings | [pages/system.tsx:125](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L125) | Español | setLocale persists browser preference | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-183 | /settings | [pages/system.tsx:133](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L133) | Reset preferences | Clear prefs then set dark and en | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-184 | / | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-185 | /live | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-186 | /positions | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-187 | /performance | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-188 | /trades | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | GET /api/v1/trades/export | no | legacy-only |
| ACT-189 | /funnel | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-190 | /controls | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-191 | /strategies | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-192 | /chains | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-193 | /providers | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-194 | /manual-trade | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Disabled because no rows are passed | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-195 | /audit | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Serialize current rows to CSV and download | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-196 | /system | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Disabled because no rows are passed | browser handler — see handler | none | no | legacy-only — client-only, serialize already loaded rows or dispatch export |
| ACT-197 | /settings | [ui.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L35) | Export / Exportar | Disabled because no rows are passed | browser handler — see handler | none | no | legacy-only — client-only, browser preference |
| ACT-198 | /performance | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 1h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/performance | no | legacy-only |
| ACT-199 | /performance | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 6h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/performance | no | legacy-only |
| ACT-200 | /performance | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 24h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/performance | no | legacy-only |
| ACT-201 | /performance | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 7d | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/performance | no | legacy-only |
| ACT-202 | /performance | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 30d | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/performance | no | legacy-only |
| ACT-203 | /performance | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | ytd | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/performance | no | legacy-only |
| ACT-204 | /performance | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | all | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/performance | no | legacy-only |
| ACT-205 | /trades | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 1h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/trades | no | legacy-only |
| ACT-206 | /trades | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 6h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/trades | no | legacy-only |
| ACT-207 | /trades | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 24h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/trades | no | legacy-only |
| ACT-208 | /trades | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 7d | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/trades | no | legacy-only |
| ACT-209 | /trades | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 30d | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/trades | no | legacy-only |
| ACT-210 | /trades | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | ytd | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/trades | no | legacy-only |
| ACT-211 | /trades | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | all | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/trades | no | legacy-only |
| ACT-212 | /funnel | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 1h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/funnel | no | legacy-only |
| ACT-213 | /funnel | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 6h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/funnel | no | legacy-only |
| ACT-214 | /funnel | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 24h | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/funnel | no | legacy-only |
| ACT-215 | /funnel | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 7d | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/funnel | no | legacy-only |
| ACT-216 | /funnel | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | 30d | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/funnel | no | legacy-only |
| ACT-217 | /funnel | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | ytd | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/funnel | no | legacy-only |
| ACT-218 | /funnel | [ui.tsx:54](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L54) | all | setRange updates shared browser state; does not refetch | browser handler — see handler | GET /api/v1/funnel | no | legacy-only |
| ACT-219 | /controls | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-220 | /controls | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-221 | /controls | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-222 | /controls | [ui.tsx:154](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L154) | Typed confirmation | Read through FormData on submit | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-223 | /controls | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-224 | /controls | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-225 | /controls | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-226 | /controls | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-227 | /controls | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-228 | /controls | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-229 | /controls | [ui.tsx:154](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L154) | Typed confirmation | Read through FormData on submit | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-230 | /controls | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-231 | /controls | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-232 | /controls | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-233 | /controls | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-234 | /controls | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-235 | /controls | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-236 | /controls | [ui.tsx:154](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L154) | Typed confirmation | Read through FormData on submit | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-237 | /controls | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-238 | /controls | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-239 | /controls | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-240 | /controls | [ui.tsx:154](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L154) | Typed confirmation | Read through FormData on submit | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-241 | /positions | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-242 | /positions | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-243 | /positions | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-244 | /chains | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-245 | /chains | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-246 | /chains | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-247 | /chains | [ui.tsx:154](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L154) | Typed confirmation | Read through FormData on submit | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-248 | /manual-trade | [ui.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L134) | Confirmation backdrop | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-249 | /manual-trade | [ui.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L140) | Confirmation interior | stopPropagation | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-250 | /manual-trade | [ui.tsx:164](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L164) | Cancel | onClose | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-251 | /manual-trade | [ui.tsx:154](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/ui.tsx#L154) | Typed confirmation | Read through FormData on submit | browser handler — see handler | none | no | legacy-only — client-only, browser UI state or event handling |
| ACT-252 | / | [routes/index.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/index.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-253 | /live | [routes/live.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/live.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-254 | /positions | [routes/positions.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/positions.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-255 | /performance | [routes/performance.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/performance.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-256 | /trades | [routes/trades.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/trades.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-257 | /funnel | [routes/funnel.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/funnel.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-258 | /controls | [routes/controls.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/controls.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-259 | /strategies | [routes/strategies.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/strategies.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-260 | /chains | [routes/chains.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/chains.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-261 | /providers | [routes/providers.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/providers.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-262 | /manual-trade | [routes/manual-trade.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/manual-trade.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-263 | /audit | [routes/audit.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/audit.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-264 | /system | [routes/system.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/system.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |
| ACT-265 | /settings | [routes/settings.tsx](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/routes/settings.tsx) | Route definition | createFileRoute | browser router | none | no | legacy-only — client-only, navigation; reads are inventoried under the rendered page |

## Table 2 — Data reads

| # | Page | Component | What it renders | Current source | Verb / endpoint | Target cadence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| READ-001 | all | [shell.tsx:192](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L192) | Cycle age | store.cycleSec | GET /api/v1/status | 5s poll | legacy-only |
| READ-002 | all | [shell.tsx:194](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L194) | Operating mode | store.operatingMode | GET /api/v1/mode | 5s poll | legacy-only |
| READ-003 | all | [shell.tsx:198](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L198) | Live authorization badge | store.liveArmed | GET /api/v1/status | 5s poll | legacy-only |
| READ-004 | all | [shell.tsx:201](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L201) | Entries badge | store.entriesRunning | GET /api/v1/status | 5s poll | legacy-only |
| READ-005 | all | [shell.tsx:204](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L204) | Exposure | sum of store.positions sizes | GET /api/v1/positions | 10s poll | legacy-only |
| READ-006 | all | [shell.tsx:207](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L207) | Daily PnL | store.dayPnl | GET /api/v1/status | 5s poll | legacy-only |
| READ-007 | all | [shell.tsx:224](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L224) | Notification count and rows | store.notices | GET /api/v1/status | 5s poll | legacy-only |
| READ-008 | all | [shell.tsx:302](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L302) | Mode banner | store.operatingMode | GET /api/v1/mode | 5s poll | legacy-only |
| READ-009 | all | [shell.tsx:315](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L315) | Kill confirmation position count | store.positions | GET /api/v1/positions | on demand | legacy-only |
| READ-010 | all | [shell.tsx:316](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/shell.tsx#L316) | Kill confirmation live flag | store.liveArmed | GET /api/v1/status | on demand | legacy-only |
| READ-011 | all | [palette.tsx:29](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L29) | Position search results | store.positions | GET /api/v1/positions | on demand | legacy-only |
| READ-012 | all | [palette.tsx:30](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L30) | Strategy names and enabled flags | store.strategies | GET /api/v1/strategies | on demand | legacy-only |
| READ-013 | all | [palette.tsx:31](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/palette.tsx#L31) | Chain names and enabled flags | store.chains | GET /api/v1/chains | on demand | legacy-only |
| READ-014 | / | [pages/overview.tsx:37](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L37) | Simple open positions | store.positions.length | GET /api/v1/positions | 10s poll | legacy-only |
| READ-015 | / | [pages/overview.tsx:37](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L37) | Simple last cycle | store.cycleSec | GET /api/v1/status | 5s poll | legacy-only |
| READ-016 | / | [pages/overview.tsx:14](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L14) | Equity total | store.equity | GET /api/v1/equity | 30s poll | legacy-only |
| READ-017 | / | [pages/overview.tsx:15](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L15) | Daily change headline | store.dayPnl | GET /api/v1/status | 5s poll | legacy-only |
| READ-018 | / | [pages/overview.tsx:47](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L47) | Unrealized PnL | aggregate store.positions | GET /api/v1/positions | 10s poll | legacy-only |
| READ-019 | / | [pages/overview.tsx:48](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L48) | Exposure | aggregate store.positions | GET /api/v1/positions | 10s poll | legacy-only |
| READ-020 | / | [pages/overview.tsx:49](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L49) | Open count KPI | store.positions.length | GET /api/v1/positions | 10s poll | legacy-only |
| READ-021 | / | [pages/overview.tsx:53](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L53) | Equity chart and tooltip | fixture equitySeries | GET /api/v1/equity | 30s poll | legacy-only |
| READ-022 | / | [pages/overview.tsx:61](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L61) | Open position preview rows | store.positions | GET /api/v1/positions | 10s poll | legacy-only |
| READ-023 | / | [pages/overview.tsx:74](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L74) | Recent audit preview | store.events | GET /api/v1/audit | on demand | legacy-only |
| READ-024 | / | [pages/overview.tsx:83](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L83) | Drawdown KPI | hard-coded 1.2% | GET /api/v1/status | 5s poll | legacy-only |
| READ-025 | / | [pages/overview.tsx:84](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L84) | Last cycle KPI | store.cycleSec | GET /api/v1/status | 5s poll | legacy-only |
| READ-026 | / | [pages/overview.tsx:85](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L85) | Daily PnL KPI | store.dayPnl | GET /api/v1/status | 5s poll | legacy-only |
| READ-027 | /performance | [pages/analysis.tsx:35](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L35) | Equity KPI | hard-coded 12847 | GET /api/v1/equity | 30s poll | legacy-only |
| READ-028 | /performance | [pages/analysis.tsx:36](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L36) | Win rate | derived from store.trades | GET /api/v1/performance | on demand | legacy-only |
| READ-029 | /performance | [pages/analysis.tsx:37](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L37) | Expectancy | derived from store.trades | GET /api/v1/performance | on demand | legacy-only |
| READ-030 | /performance | [pages/analysis.tsx:38](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L38) | Profit factor | derived from store.trades | GET /api/v1/performance | on demand | legacy-only |
| READ-031 | /performance | [pages/analysis.tsx:39](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L39) | Average win | derived from store.trades | GET /api/v1/performance | on demand | legacy-only |
| READ-032 | /performance | [pages/analysis.tsx:40](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L40) | Sharpe 30d | hard-coded 1.42 | GET /api/v1/performance | on demand | legacy-only |
| READ-033 | /performance | [pages/analysis.tsx:46](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L46) | Equity chart and tooltip | fixture equitySeries | GET /api/v1/performance | on demand | legacy-only |
| READ-034 | /performance | [pages/analysis.tsx:58](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L58) | Drawdown chart and tooltip | fixture equitySeries | GET /api/v1/performance | on demand | legacy-only |
| READ-035 | /performance | [pages/analysis.tsx:68](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L68) | Chain PnL bars and tooltip | grouped store.trades | GET /api/v1/performance | on demand | legacy-only |
| READ-036 | /performance | [pages/analysis.tsx:14](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L14) | Selected date range | store.range | none | local | client-only — range selection is stored in the browser; the selected range separately drives the performance read |
| READ-037 | /trades | [pages/analysis.tsx:101](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L101) | Trade count | store.trades.length | GET /api/v1/trades | on demand | legacy-only |
| READ-038 | /trades | [pages/analysis.tsx:102](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L102) | Win streak | derived from store.trades | GET /api/v1/trades | on demand | legacy-only |
| READ-039 | /trades | [pages/analysis.tsx:103](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L103) | Fees KPI | hard-coded 4.82 | GET /api/v1/performance | on demand | legacy-only |
| READ-040 | /trades | [pages/analysis.tsx:112](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L112) | Trade rows, prices, strategy, PnL, age, reason | store.trades filtered in memory | GET /api/v1/trades | on demand | legacy-only |
| READ-041 | /trades | [pages/analysis.tsx:130](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L130) | Trade detail and audit identifiers | selected store.trades row | GET /api/v1/trades/:id | on demand | legacy-only |
| READ-042 | /trades | [pages/analysis.tsx:132](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L132) | Trade PnL, return and hold time | selected store.trades row | GET /api/v1/trades/:id | on demand | legacy-only |
| READ-043 | /funnel | [pages/analysis.tsx:145](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L145) | Discovered count and relative width | fixture FUNNEL | GET /api/v1/funnel | on demand | legacy-only |
| READ-044 | /funnel | [pages/analysis.tsx:146](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L146) | Rug pass count and relative width | fixture FUNNEL | GET /api/v1/funnel | on demand | legacy-only |
| READ-045 | /funnel | [pages/analysis.tsx:147](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L147) | Sized count and relative width | fixture FUNNEL | GET /api/v1/funnel | on demand | legacy-only |
| READ-046 | /funnel | [pages/analysis.tsx:148](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L148) | Filled count and relative width | fixture FUNNEL | GET /api/v1/funnel | on demand | legacy-only |
| READ-047 | /funnel | [pages/analysis.tsx:171](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/analysis.tsx#L171) | Rejection counts and reasons | fixture FUNNEL.reasons | GET /api/v1/funnel | on demand | legacy-only |
| READ-048 | /live | [pages/markets.tsx:32](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L32) | Cycle identifier, age, stage | literal 1102 and store.cycleSec/entriesRunning | GET /api/v1/status | 5s poll | legacy-only |
| READ-049 | /live | [pages/markets.tsx:34](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L34) | Cycling / paused | store.entriesRunning | GET /api/v1/status | 5s poll | legacy-only |
| READ-050 | /live | [pages/markets.tsx:45](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L45) | Live event rows | store.events | GET /api/v1/audit | manual refresh; freeze is local | legacy-only |
| READ-051 | /positions | [pages/markets.tsx:90](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L90) | Open positions rows, size, entry, mark, PnL, age | store.positions | GET /api/v1/positions | 10s poll | legacy-only |
| READ-052 | /positions | [pages/markets.tsx:118](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L118) | Selected pair, address and chain | selected store.positions row | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-053 | /positions | [pages/markets.tsx:124](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L124) | Liquidity | selected.liquidity | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-054 | /positions | [pages/markets.tsx:125](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L125) | 24h volume headline | selected.volume24h | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-055 | /positions | [pages/markets.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L128) | Price | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-056 | /positions | [pages/markets.tsx:129](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L129) | FDV | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-057 | /positions | [pages/markets.tsx:130](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L130) | Market cap | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-058 | /positions | [pages/markets.tsx:131](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L131) | Pool age | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-059 | /positions | [pages/markets.tsx:134](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L134) | 5m volume | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-060 | /positions | [pages/markets.tsx:135](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L135) | 1h volume | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-061 | /positions | [pages/markets.tsx:136](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L136) | 6h volume | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-062 | /positions | [pages/markets.tsx:137](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L137) | 24h volume | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-063 | /positions | [pages/markets.tsx:140](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L140) | 5m change | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-064 | /positions | [pages/markets.tsx:141](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L141) | 1h change | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-065 | /positions | [pages/markets.tsx:142](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L142) | 6h change | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-066 | /positions | [pages/markets.tsx:143](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L143) | 24h change | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-067 | /positions | [pages/markets.tsx:146](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L146) | Buys and sells | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-068 | /positions | [pages/markets.tsx:147](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L147) | Buyers and sellers | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-069 | /positions | [pages/markets.tsx:148](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L148) | Volume/liquidity | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-070 | /positions | [pages/markets.tsx:149](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L149) | Locked percentage | selected store.positions market data | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-071 | /positions | [pages/markets.tsx:152](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/markets.tsx#L152) | Position flags | selected.flags | GET /api/v1/positions/:id | on demand | legacy-only |
| READ-072 | /controls | [pages/control.tsx:27](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L27) | Armed badge | store.liveArmed | GET /api/v1/status | 5s poll | legacy-only |
| READ-073 | /controls | [pages/control.tsx:33](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L33) | Entries badge | store.entriesRunning | GET /api/v1/status | 5s poll | legacy-only |
| READ-074 | /controls | [pages/control.tsx:39](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L39) | Routine exits badge | store.exitsRunning | GET /api/v1/status | 5s poll | legacy-only |
| READ-075 | /controls | [pages/control.tsx:13](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L13) | Operating mode | store.operatingMode | GET /api/v1/mode | on demand | legacy-only |
| READ-076 | /controls | [pages/control.tsx:62](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L62) | Max risk per trade | draft from store.risk | GET /api/v1/risk | on demand | legacy-only |
| READ-077 | /controls | [pages/control.tsx:63](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L63) | Max depth | draft from store.risk | GET /api/v1/risk | on demand | legacy-only |
| READ-078 | /controls | [pages/control.tsx:64](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L64) | Slippage | draft from store.risk | GET /api/v1/risk | on demand | legacy-only |
| READ-079 | /controls | [pages/control.tsx:65](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L65) | Daily trading cap | draft from store.risk | GET /api/v1/trading-limits | on demand | legacy-only |
| READ-080 | /controls | [pages/control.tsx:66](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L66) | Per-trade cap | draft from store.risk | GET /api/v1/trading-limits | on demand | legacy-only |
| READ-081 | /controls | [pages/control.tsx:73](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L73) | Breaker state | store.breakerTripped | GET /api/v1/status | 5s poll | legacy-only |
| READ-082 | /controls | [pages/control.tsx:82](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L82) | Receipt timeline and state | store.receipts | GET /api/v1/receipts/:request_id | while pending; each known request ID | legacy-only |
| READ-083 | /strategies | [pages/control.tsx:128](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L128) | Strategy rows, enabled state, chains, signals, win rate, PnL | store.strategies | GET /api/v1/strategies | on demand | legacy-only |
| READ-084 | /strategies | [pages/control.tsx:143](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L143) | Selected strategy lookback, threshold, max size | selected strategy.params | GET /api/v1/strategies/:id | on demand | legacy-only |
| READ-085 | /chains | [pages/control.tsx:168](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L168) | Enabled flag and dashboard metrics | store.chains | GET /api/v1/chains | on demand | legacy-only |
| READ-086 | /chains | [pages/control.tsx:182](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L182) | Capital allocation and live draft total | draft from store.chains | GET /api/v1/chains | on demand | legacy-only |
| READ-087 | /providers | [pages/control.tsx:197](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L197) | Routing mode | store.operatingMode | GET /api/v1/mode | on demand | legacy-only |
| READ-088 | /providers | [pages/control.tsx:212](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L212) | Provider health | store.providers | GET /api/v1/providers | on demand | legacy-only |
| READ-089 | /providers | [pages/control.tsx:199](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L199) | Routing order | store.providerOrder | GET /api/v1/providers | on demand | legacy-only |
| READ-090 | /providers | [pages/control.tsx:213](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L213) | Model, latency, cost and budget | store.providers | GET /api/v1/providers | on demand | legacy-only |
| READ-091 | /manual-trade | [pages/control.tsx:271](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L271) | Selectable chain capabilities | hard-coded chain options | GET /api/v1/chains | on demand | legacy-only |
| READ-092 | /manual-trade | [pages/control.tsx:282](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L282) | Quote preview, price, impact and minimum out | store.previewQuote fixture calculation | POST /api/v1/quote | on demand | legacy-only |
| READ-093 | /manual-trade | [pages/control.tsx:286](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L286) | Today filled count | fixture FUNNEL.filled | GET /api/v1/funnel | on demand | legacy-only |
| READ-094 | /audit | [pages/system.tsx:39](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L39) | Audit timeline, time, agent, severity and summary | store.events | GET /api/v1/audit | cursor on demand | legacy-only |
| READ-095 | /audit | [pages/system.tsx:48](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L48) | Expanded event JSON | selected loaded event | GET /api/v1/audit | on demand | legacy-only |
| READ-096 | /system | [pages/system.tsx:58](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L58) | Diagnostic snapshot | local bundle from store.events and hard-coded status | GET /api/v1/system/diagnostics | on demand | legacy-only |
| READ-097 | /system | [pages/system.tsx:74](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L74) | Endpoint coverage and availability | fixture COVERAGE | GET /api/v1/system/health | on demand | legacy-only |
| READ-098 | /settings | [pages/system.tsx:103](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L103) | Theme | store.theme | none | local | client-only — theme is a browser preference |
| READ-099 | /settings | [pages/system.tsx:104](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L104) | Display mode | store.viewMode | none | local | client-only — display mode is a browser preference |
| READ-100 | /settings | [pages/system.tsx:105](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L105) | Density | store.density | none | local | client-only — density is a browser preference |
| READ-101 | /settings | [pages/system.tsx:102](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L102) | Language | store.locale | none | local | client-only — language is a browser preference |
| READ-102 | / | [pages/overview.tsx:40](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L40) | Simple drawdown | fixture 1.2% | GET /api/v1/status | on demand | legacy-only |
| READ-103 | / | [pages/overview.tsx:40](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L40) | Simple unrealized PnL | sum of position mark PnL | GET /api/v1/positions | on demand | legacy-only |
| READ-104 | / | [pages/overview.tsx:40](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/overview.tsx#L40) | Simple exposure | sum of position sizes | GET /api/v1/positions | on demand | legacy-only |
| READ-105 | /system | [pages/system.tsx:87](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L87) | Worker latency p50, p95, p99 | literals | GET /api/v1/system/health | on demand | legacy-only |
| READ-106 | /system | [pages/system.tsx:88](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L88) | Worker uptime and restart count | literals | GET /api/v1/system/health | on demand | legacy-only |
| READ-107 | /system | [pages/system.tsx:91](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L91) | Per-agent latency | literals | GET /api/v1/system/health | on demand | legacy-only |
| READ-108 | /system | [pages/system.tsx:94](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/system.tsx#L94) | Recon hit, response hit and dedup count | literals | GET /api/v1/system/health | on demand | legacy-only |
| READ-109 | /strategies | [pages/control.tsx:119](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L119) | Enabled strategy count | store.strategies | GET /api/v1/strategies | on demand | legacy-only |
| READ-110 | /strategies | [pages/control.tsx:119](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L119) | Signals today | sum of strategy signals24h | GET /api/v1/strategies | on demand | legacy-only |
| READ-111 | /chains | [pages/control.tsx:171](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L171) | Exposure, daily PnL and win rate | store.chains | GET /api/v1/chains | on demand | legacy-only |
| READ-112 | /chains | [pages/control.tsx:172](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L172) | Memecoin filter description | store.chains | GET /api/v1/chains | on demand | legacy-only |
| READ-113 | /chains | [pages/control.tsx:173](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L173) | Open position count | store.chains | GET /api/v1/chains | on demand | legacy-only |
| READ-114 | /chains | [pages/control.tsx:185](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L185) | Allocation total and dry powder | derived from allocation draft | none | local | client-only — allocation totals are calculated from the unsaved browser draft |
| READ-115 | /providers | [pages/control.tsx:215](https://github.com/cmarin001/dex-orchestrator-app/blob/84ccb725c56ad62ad9ef2a05966ca98e8e40a64c/src/desk/pages/control.tsx#L215) | Provider enabled state | store.providers | GET /api/v1/providers | on demand | legacy-only |

## Table 3 — Traceability

| # | Element ID | Endpoint ID | Endpoint | Verified by |
| --- | --- | --- | --- | --- |
| TRC-001 | ACT-001 | none | none | UI-only regression check (planned) |
| TRC-002 | ACT-002 | none | none | UI-only regression check (planned) |
| TRC-003 | ACT-003 | none | none | UI-only regression check (planned) |
| TRC-004 | ACT-004 | none | none | UI-only regression check (planned) |
| TRC-005 | ACT-005 | none | none | UI-only regression check (planned) |
| TRC-006 | ACT-006 | none | none | UI-only regression check (planned) |
| TRC-007 | ACT-007 | none | none | UI-only regression check (planned) |
| TRC-008 | ACT-008 | none | none | UI-only regression check (planned) |
| TRC-009 | ACT-009 | none | none | UI-only regression check (planned) |
| TRC-010 | ACT-010 | none | none | UI-only regression check (planned) |
| TRC-011 | ACT-011 | none | none | UI-only regression check (planned) |
| TRC-012 | ACT-012 | none | none | UI-only regression check (planned) |
| TRC-013 | ACT-013 | none | none | UI-only regression check (planned) |
| TRC-014 | ACT-014 | none | none | UI-only regression check (planned) |
| TRC-015 | ACT-015 | none | none | UI-only regression check (planned) |
| TRC-016 | ACT-016 | none | none | UI-only regression check (planned) |
| TRC-017 | ACT-017 | none | none | UI-only regression check (planned) |
| TRC-018 | ACT-018 | EP-001 | POST /api/v1/controls/kill-switch | contract/kill (planned) |
| TRC-019 | ACT-019 | none | none | UI-only regression check (planned) |
| TRC-020 | ACT-020 | none | none | UI-only regression check (planned) |
| TRC-021 | ACT-021 | EP-001 | POST /api/v1/controls/kill-switch | contract/kill (planned) |
| TRC-022 | ACT-022 | none | none | UI-only regression check (planned) |
| TRC-023 | ACT-023 | none | none | UI-only regression check (planned) |
| TRC-024 | ACT-024 | none | none | UI-only regression check (planned) |
| TRC-025 | ACT-025 | none | none | UI-only regression check (planned) |
| TRC-026 | ACT-026 | none | none | UI-only regression check (planned) |
| TRC-027 | ACT-027 | none | none | UI-only regression check (planned) |
| TRC-028 | ACT-028 | EP-002, EP-003 | POST /api/v1/controls/pause / POST /api/v1/controls/resume | contract/pause (planned), contract/resume (planned) |
| TRC-029 | ACT-029 | none | none | UI-only regression check (planned) |
| TRC-030 | ACT-030 | none | none | UI-only regression check (planned) |
| TRC-031 | ACT-031 | none | none | UI-only regression check (planned) |
| TRC-032 | ACT-032 | none | none | UI-only regression check (planned) |
| TRC-033 | ACT-033 | none | none | UI-only regression check (planned) |
| TRC-034 | ACT-034 | none | none | UI-only regression check (planned) |
| TRC-035 | ACT-035 | none | none | UI-only regression check (planned) |
| TRC-036 | ACT-036 | none | none | UI-only regression check (planned) |
| TRC-037 | ACT-037 | none | none | UI-only regression check (planned) |
| TRC-038 | ACT-038 | none | none | UI-only regression check (planned) |
| TRC-039 | ACT-039 | none | none | UI-only regression check (planned) |
| TRC-040 | ACT-040 | none | none | UI-only regression check (planned) |
| TRC-041 | ACT-041 | none | none | UI-only regression check (planned) |
| TRC-042 | ACT-042 | none | none | UI-only regression check (planned) |
| TRC-043 | ACT-043 | none | none | UI-only regression check (planned) |
| TRC-044 | ACT-044 | none | none | UI-only regression check (planned) |
| TRC-045 | ACT-045 | none | none | UI-only regression check (planned) |
| TRC-046 | ACT-046 | none | none | UI-only regression check (planned) |
| TRC-047 | ACT-047 | none | none | UI-only regression check (planned) |
| TRC-048 | ACT-048 | none | none | UI-only regression check (planned) |
| TRC-049 | ACT-049 | none | none | UI-only regression check (planned) |
| TRC-050 | ACT-050 | none | none | UI-only regression check (planned) |
| TRC-051 | ACT-051 | none | none | UI-only regression check (planned) |
| TRC-052 | ACT-052 | none | none | UI-only regression check (planned) |
| TRC-053 | ACT-053 | none | none | UI-only regression check (planned) |
| TRC-054 | ACT-054 | none | none | UI-only regression check (planned) |
| TRC-055 | ACT-055 | none | none | UI-only regression check (planned) |
| TRC-056 | ACT-056 | none | none | UI-only regression check (planned) |
| TRC-057 | ACT-057 | none | none | UI-only regression check (planned) |
| TRC-058 | ACT-058 | none | none | UI-only regression check (planned) |
| TRC-059 | ACT-059 | none | none | UI-only regression check (planned) |
| TRC-060 | ACT-060 | none | none | UI-only regression check (planned) |
| TRC-061 | ACT-061 | none | none | UI-only regression check (planned) |
| TRC-062 | ACT-062 | none | none | UI-only regression check (planned) |
| TRC-063 | ACT-063 | none | none | UI-only regression check (planned) |
| TRC-064 | ACT-064 | none | none | UI-only regression check (planned) |
| TRC-065 | ACT-065 | none | none | UI-only regression check (planned) |
| TRC-066 | ACT-066 | none | none | UI-only regression check (planned) |
| TRC-067 | ACT-067 | none | none | UI-only regression check (planned) |
| TRC-068 | ACT-068 | none | none | UI-only regression check (planned) |
| TRC-069 | ACT-069 | none | none | UI-only regression check (planned) |
| TRC-070 | ACT-070 | none | none | UI-only regression check (planned) |
| TRC-071 | ACT-071 | none | none | UI-only regression check (planned) |
| TRC-072 | ACT-072 | none | none | UI-only regression check (planned) |
| TRC-073 | ACT-073 | none | none | UI-only regression check (planned) |
| TRC-074 | ACT-074 | none | none | UI-only regression check (planned) |
| TRC-075 | ACT-075 | none | none | UI-only regression check (planned) |
| TRC-076 | ACT-076 | none | none | UI-only regression check (planned) |
| TRC-077 | ACT-077 | none | none | UI-only regression check (planned) |
| TRC-078 | ACT-078 | none | none | UI-only regression check (planned) |
| TRC-079 | ACT-079 | none | none | UI-only regression check (planned) |
| TRC-080 | ACT-080 | none | none | UI-only regression check (planned) |
| TRC-081 | ACT-081 | none | none | UI-only regression check (planned) |
| TRC-082 | ACT-082 | EP-002 | POST /api/v1/controls/pause | contract/pause (planned) |
| TRC-083 | ACT-083 | EP-003 | POST /api/v1/controls/resume | contract/resume (planned) |
| TRC-084 | ACT-084 | none | none | UI-only regression check (planned) |
| TRC-085 | ACT-085 | EP-004 | POST /api/v1/controls/live-execution | contract/live (planned) |
| TRC-086 | ACT-086 | none | none | UI-only regression check (planned) |
| TRC-087 | ACT-087 | EP-005 | POST /api/v1/controls/exits/pause | contract/exits (planned) |
| TRC-088 | ACT-088 | EP-006 | POST /api/v1/controls/exits/resume | contract/exits_resume (planned) |
| TRC-089 | ACT-089 | EP-007 | POST /api/v1/mode | contract/mode (planned) |
| TRC-090 | ACT-090 | EP-007 | POST /api/v1/mode | contract/mode (planned) |
| TRC-091 | ACT-091 | EP-007 | POST /api/v1/mode | contract/mode (planned) |
| TRC-092 | ACT-092 | EP-007 | POST /api/v1/mode | contract/mode (planned) |
| TRC-093 | ACT-093 | none | none | UI-only regression check (planned) |
| TRC-094 | ACT-094 | none | none | UI-only regression check (planned) |
| TRC-095 | ACT-095 | none | none | UI-only regression check (planned) |
| TRC-096 | ACT-096 | none | none | UI-only regression check (planned) |
| TRC-097 | ACT-097 | none | none | UI-only regression check (planned) |
| TRC-098 | ACT-098 | none | none | UI-only regression check (planned) |
| TRC-099 | ACT-099 | EP-008 | POST /api/v1/controls/circuit-breaker/reset | contract/breaker (planned) |
| TRC-100 | ACT-100 | none | none | UI-only regression check (planned) |
| TRC-101 | ACT-101 | none | none | UI-only regression check (planned) |
| TRC-102 | ACT-102 | none | none | UI-only regression check (planned) |
| TRC-103 | ACT-103 | EP-009 | GET /api/v1/trades/export | contract/export_trades (planned) |
| TRC-104 | ACT-104 | none | none | UI-only regression check (planned) |
| TRC-105 | ACT-105 | none | none | UI-only regression check (planned) |
| TRC-106 | ACT-106 | EP-010, EP-011 | POST /api/v1/strategies/:id/enable / POST /api/v1/strategies/:id/disable | contract/strategy_enable (planned), contract/strategy_disable (planned) |
| TRC-107 | ACT-107 | EP-012 | POST /api/v1/controls/chain | contract/chain_write (planned) |
| TRC-108 | ACT-108 | none | none | UI-only regression check (planned) |
| TRC-109 | ACT-109 | none | none | UI-only regression check (planned) |
| TRC-110 | ACT-110 | none | none | UI-only regression check (planned) |
| TRC-111 | ACT-111 | none | none | UI-only regression check (planned) |
| TRC-112 | ACT-112 | none | none | UI-only regression check (planned) |
| TRC-113 | ACT-113 | none | none | UI-only regression check (planned) |
| TRC-114 | ACT-114 | none | none | UI-only regression check (planned) |
| TRC-115 | ACT-115 | none | none | UI-only regression check (planned) |
| TRC-116 | ACT-116 | none | none | UI-only regression check (planned) |
| TRC-117 | ACT-117 | none | none | UI-only regression check (planned) |
| TRC-118 | ACT-118 | none | none | UI-only regression check (planned) |
| TRC-119 | ACT-119 | none | none | UI-only regression check (planned) |
| TRC-120 | ACT-120 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-121 | ACT-121 | none | none | UI-only regression check (planned) |
| TRC-122 | ACT-122 | none | none | UI-only regression check (planned) |
| TRC-123 | ACT-123 | none | none | UI-only regression check (planned) |
| TRC-124 | ACT-124 | none | none | UI-only regression check (planned) |
| TRC-125 | ACT-125 | EP-014 | POST /api/v1/controls/exit | contract/exit (planned) |
| TRC-126 | ACT-126 | none | none | UI-only regression check (planned) |
| TRC-127 | ACT-127 | none | none | UI-only regression check (planned) |
| TRC-128 | ACT-128 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-129 | ACT-129 | EP-016 | GET /api/v1/trades/:id | contract/trade_detail (planned) |
| TRC-130 | ACT-130 | none | none | UI-only regression check (planned) |
| TRC-131 | ACT-131 | none | none | UI-only regression check (planned) |
| TRC-132 | ACT-132 | none | none | UI-only regression check (planned) |
| TRC-133 | ACT-133 | none | none | UI-only regression check (planned) |
| TRC-134 | ACT-134 | EP-002, EP-003 | POST /api/v1/controls/pause / POST /api/v1/controls/resume | contract/pause (planned), contract/resume (planned) |
| TRC-135 | ACT-135 | none | none | UI-only regression check (planned) |
| TRC-136 | ACT-136 | none | none | UI-only regression check (planned) |
| TRC-137 | ACT-137 | none | none | UI-only regression check (planned) |
| TRC-138 | ACT-138 | none | none | UI-only regression check (planned) |
| TRC-139 | ACT-139 | none | none | UI-only regression check (planned) |
| TRC-140 | ACT-140 | none | none | UI-only regression check (planned) |
| TRC-141 | ACT-141 | none | none | UI-only regression check (planned) |
| TRC-142 | ACT-142 | none | none | UI-only regression check (planned) |
| TRC-143 | ACT-143 | none | none | UI-only regression check (planned) |
| TRC-144 | ACT-144 | EP-008 | POST /api/v1/controls/circuit-breaker/reset | contract/breaker (planned) |
| TRC-145 | ACT-145 | EP-004 | POST /api/v1/controls/live-execution | contract/live (planned) |
| TRC-146 | ACT-146 | EP-004 | POST /api/v1/controls/live-execution | contract/live (planned) |
| TRC-147 | ACT-147 | EP-017, EP-018 | POST /api/v1/controls/risk / POST /api/v1/controls/trading-limits | contract/risk_write (planned), contract/limits_write (planned) |
| TRC-148 | ACT-148 | EP-007 | POST /api/v1/mode | contract/mode (planned) |
| TRC-149 | ACT-149 | EP-001 | POST /api/v1/controls/kill-switch | contract/kill (planned) |
| TRC-150 | ACT-150 | EP-005, EP-006 | POST /api/v1/controls/exits/pause / POST /api/v1/controls/exits/resume | contract/exits (planned), contract/exits_resume (planned) |
| TRC-151 | ACT-151 | none | none | UI-only regression check (planned) |
| TRC-152 | ACT-152 | EP-019 | GET /api/v1/strategies/:id | contract/strategy_detail (planned) |
| TRC-153 | ACT-153 | EP-010, EP-011 | POST /api/v1/strategies/:id/enable / POST /api/v1/strategies/:id/disable | contract/strategy_enable (planned), contract/strategy_disable (planned) |
| TRC-154 | ACT-154 | EP-020 | POST /api/v1/strategies/:id/params | contract/strategy_params (planned) |
| TRC-155 | ACT-155 | none | none | UI-only regression check (planned) |
| TRC-156 | ACT-156 | EP-012 | POST /api/v1/controls/chain | contract/chain_write (planned) |
| TRC-157 | ACT-157 | none | none | UI-only regression check (planned) |
| TRC-158 | ACT-158 | none | none | UI-only regression check (planned) |
| TRC-159 | ACT-159 | EP-012 | POST /api/v1/controls/chain | contract/chain_write (planned) |
| TRC-160 | ACT-160 | EP-021, EP-022 | POST /api/v1/providers/:id/enable / POST /api/v1/providers/:id/disable | contract/provider_enable (planned), contract/provider_disable (planned) |
| TRC-161 | ACT-161 | EP-023 | POST /api/v1/controls/providers/order | contract/order (planned) |
| TRC-162 | ACT-162 | EP-023 | POST /api/v1/controls/providers/order | contract/order (planned) |
| TRC-163 | ACT-163 | none | none | UI-only regression check (planned) |
| TRC-164 | ACT-164 | none | none | UI-only regression check (planned) |
| TRC-165 | ACT-165 | none | none | UI-only regression check (planned) |
| TRC-166 | ACT-166 | none | none | UI-only regression check (planned) |
| TRC-167 | ACT-167 | none | none | UI-only regression check (planned) |
| TRC-168 | ACT-168 | none | none | UI-only regression check (planned) |
| TRC-169 | ACT-169 | EP-024 | POST /api/v1/quote | contract/quote (planned) |
| TRC-170 | ACT-170 | none | none | UI-only regression check (planned) |
| TRC-171 | ACT-171 | EP-025 | POST /api/v1/controls/manual-trade | contract/manual (planned) |
| TRC-172 | ACT-172 | EP-026 | GET /api/v1/audit/export | contract/export_audit (planned) |
| TRC-173 | ACT-173 | EP-027 | GET /api/v1/audit | contract/audit (planned) |
| TRC-174 | ACT-174 | EP-027 | GET /api/v1/audit | contract/audit (planned) |
| TRC-175 | ACT-175 | none | none | UI-only regression check (planned) |
| TRC-176 | ACT-176 | EP-028 | GET /api/v1/system/diagnostics | contract/diagnostics (planned) |
| TRC-177 | ACT-177 | none | none | UI-only regression check (planned) |
| TRC-178 | ACT-178 | none | none | UI-only regression check (planned) |
| TRC-179 | ACT-179 | none | none | UI-only regression check (planned) |
| TRC-180 | ACT-180 | none | none | UI-only regression check (planned) |
| TRC-181 | ACT-181 | none | none | UI-only regression check (planned) |
| TRC-182 | ACT-182 | none | none | UI-only regression check (planned) |
| TRC-183 | ACT-183 | none | none | UI-only regression check (planned) |
| TRC-184 | ACT-184 | none | none | UI-only regression check (planned) |
| TRC-185 | ACT-185 | none | none | UI-only regression check (planned) |
| TRC-186 | ACT-186 | none | none | UI-only regression check (planned) |
| TRC-187 | ACT-187 | none | none | UI-only regression check (planned) |
| TRC-188 | ACT-188 | EP-009 | GET /api/v1/trades/export | contract/export_trades (planned) |
| TRC-189 | ACT-189 | none | none | UI-only regression check (planned) |
| TRC-190 | ACT-190 | none | none | UI-only regression check (planned) |
| TRC-191 | ACT-191 | none | none | UI-only regression check (planned) |
| TRC-192 | ACT-192 | none | none | UI-only regression check (planned) |
| TRC-193 | ACT-193 | none | none | UI-only regression check (planned) |
| TRC-194 | ACT-194 | none | none | UI-only regression check (planned) |
| TRC-195 | ACT-195 | none | none | UI-only regression check (planned) |
| TRC-196 | ACT-196 | none | none | UI-only regression check (planned) |
| TRC-197 | ACT-197 | none | none | UI-only regression check (planned) |
| TRC-198 | ACT-198 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-199 | ACT-199 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-200 | ACT-200 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-201 | ACT-201 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-202 | ACT-202 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-203 | ACT-203 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-204 | ACT-204 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-205 | ACT-205 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-206 | ACT-206 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-207 | ACT-207 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-208 | ACT-208 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-209 | ACT-209 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-210 | ACT-210 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-211 | ACT-211 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-212 | ACT-212 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-213 | ACT-213 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-214 | ACT-214 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-215 | ACT-215 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-216 | ACT-216 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-217 | ACT-217 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-218 | ACT-218 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-219 | ACT-219 | none | none | UI-only regression check (planned) |
| TRC-220 | ACT-220 | none | none | UI-only regression check (planned) |
| TRC-221 | ACT-221 | none | none | UI-only regression check (planned) |
| TRC-222 | ACT-222 | none | none | UI-only regression check (planned) |
| TRC-223 | ACT-223 | none | none | UI-only regression check (planned) |
| TRC-224 | ACT-224 | none | none | UI-only regression check (planned) |
| TRC-225 | ACT-225 | none | none | UI-only regression check (planned) |
| TRC-226 | ACT-226 | none | none | UI-only regression check (planned) |
| TRC-227 | ACT-227 | none | none | UI-only regression check (planned) |
| TRC-228 | ACT-228 | none | none | UI-only regression check (planned) |
| TRC-229 | ACT-229 | none | none | UI-only regression check (planned) |
| TRC-230 | ACT-230 | none | none | UI-only regression check (planned) |
| TRC-231 | ACT-231 | none | none | UI-only regression check (planned) |
| TRC-232 | ACT-232 | none | none | UI-only regression check (planned) |
| TRC-233 | ACT-233 | none | none | UI-only regression check (planned) |
| TRC-234 | ACT-234 | none | none | UI-only regression check (planned) |
| TRC-235 | ACT-235 | none | none | UI-only regression check (planned) |
| TRC-236 | ACT-236 | none | none | UI-only regression check (planned) |
| TRC-237 | ACT-237 | none | none | UI-only regression check (planned) |
| TRC-238 | ACT-238 | none | none | UI-only regression check (planned) |
| TRC-239 | ACT-239 | none | none | UI-only regression check (planned) |
| TRC-240 | ACT-240 | none | none | UI-only regression check (planned) |
| TRC-241 | ACT-241 | none | none | UI-only regression check (planned) |
| TRC-242 | ACT-242 | none | none | UI-only regression check (planned) |
| TRC-243 | ACT-243 | none | none | UI-only regression check (planned) |
| TRC-244 | ACT-244 | none | none | UI-only regression check (planned) |
| TRC-245 | ACT-245 | none | none | UI-only regression check (planned) |
| TRC-246 | ACT-246 | none | none | UI-only regression check (planned) |
| TRC-247 | ACT-247 | none | none | UI-only regression check (planned) |
| TRC-248 | ACT-248 | none | none | UI-only regression check (planned) |
| TRC-249 | ACT-249 | none | none | UI-only regression check (planned) |
| TRC-250 | ACT-250 | none | none | UI-only regression check (planned) |
| TRC-251 | ACT-251 | none | none | UI-only regression check (planned) |
| TRC-252 | ACT-252 | none | none | UI-only regression check (planned) |
| TRC-253 | ACT-253 | none | none | UI-only regression check (planned) |
| TRC-254 | ACT-254 | none | none | UI-only regression check (planned) |
| TRC-255 | ACT-255 | none | none | UI-only regression check (planned) |
| TRC-256 | ACT-256 | none | none | UI-only regression check (planned) |
| TRC-257 | ACT-257 | none | none | UI-only regression check (planned) |
| TRC-258 | ACT-258 | none | none | UI-only regression check (planned) |
| TRC-259 | ACT-259 | none | none | UI-only regression check (planned) |
| TRC-260 | ACT-260 | none | none | UI-only regression check (planned) |
| TRC-261 | ACT-261 | none | none | UI-only regression check (planned) |
| TRC-262 | ACT-262 | none | none | UI-only regression check (planned) |
| TRC-263 | ACT-263 | none | none | UI-only regression check (planned) |
| TRC-264 | ACT-264 | none | none | UI-only regression check (planned) |
| TRC-265 | ACT-265 | none | none | UI-only regression check (planned) |
| TRC-266 | READ-001 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-267 | READ-002 | EP-032 | GET /api/v1/mode | contract/mode_read (planned) |
| TRC-268 | READ-003 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-269 | READ-004 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-270 | READ-005 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-271 | READ-006 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-272 | READ-007 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-273 | READ-008 | EP-032 | GET /api/v1/mode | contract/mode_read (planned) |
| TRC-274 | READ-009 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-275 | READ-010 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-276 | READ-011 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-277 | READ-012 | EP-034 | GET /api/v1/strategies | contract/strategies (planned) |
| TRC-278 | READ-013 | EP-035 | GET /api/v1/chains | contract/chains_alias (planned) |
| TRC-279 | READ-014 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-280 | READ-015 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-281 | READ-016 | EP-036 | GET /api/v1/equity | contract/equity (planned) |
| TRC-282 | READ-017 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-283 | READ-018 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-284 | READ-019 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-285 | READ-020 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-286 | READ-021 | EP-036 | GET /api/v1/equity | contract/equity (planned) |
| TRC-287 | READ-022 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-288 | READ-023 | EP-027 | GET /api/v1/audit | contract/audit (planned) |
| TRC-289 | READ-024 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-290 | READ-025 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-291 | READ-026 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-292 | READ-027 | EP-036 | GET /api/v1/equity | contract/equity (planned) |
| TRC-293 | READ-028 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-294 | READ-029 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-295 | READ-030 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-296 | READ-031 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-297 | READ-032 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-298 | READ-033 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-299 | READ-034 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-300 | READ-035 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-301 | READ-036 | none | none | UI-only regression check (planned) |
| TRC-302 | READ-037 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-303 | READ-038 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-304 | READ-039 | EP-029 | GET /api/v1/performance | contract/performance (planned) |
| TRC-305 | READ-040 | EP-015 | GET /api/v1/trades | contract/trades_alias (planned) |
| TRC-306 | READ-041 | EP-016 | GET /api/v1/trades/:id | contract/trade_detail (planned) |
| TRC-307 | READ-042 | EP-016 | GET /api/v1/trades/:id | contract/trade_detail (planned) |
| TRC-308 | READ-043 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-309 | READ-044 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-310 | READ-045 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-311 | READ-046 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-312 | READ-047 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-313 | READ-048 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-314 | READ-049 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-315 | READ-050 | EP-027 | GET /api/v1/audit | contract/audit (planned) |
| TRC-316 | READ-051 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-317 | READ-052 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-318 | READ-053 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-319 | READ-054 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-320 | READ-055 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-321 | READ-056 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-322 | READ-057 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-323 | READ-058 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-324 | READ-059 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-325 | READ-060 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-326 | READ-061 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-327 | READ-062 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-328 | READ-063 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-329 | READ-064 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-330 | READ-065 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-331 | READ-066 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-332 | READ-067 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-333 | READ-068 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-334 | READ-069 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-335 | READ-070 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-336 | READ-071 | EP-013 | GET /api/v1/positions/:id | contract/position_detail (planned) |
| TRC-337 | READ-072 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-338 | READ-073 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-339 | READ-074 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-340 | READ-075 | EP-032 | GET /api/v1/mode | contract/mode_read (planned) |
| TRC-341 | READ-076 | EP-037 | GET /api/v1/risk | contract/risk (planned) |
| TRC-342 | READ-077 | EP-037 | GET /api/v1/risk | contract/risk (planned) |
| TRC-343 | READ-078 | EP-037 | GET /api/v1/risk | contract/risk (planned) |
| TRC-344 | READ-079 | EP-038 | GET /api/v1/trading-limits | contract/limits_read (planned) |
| TRC-345 | READ-080 | EP-038 | GET /api/v1/trading-limits | contract/limits_read (planned) |
| TRC-346 | READ-081 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-347 | READ-082 | EP-039 | GET /api/v1/receipts/:request_id | contract/receipt_read (planned) |
| TRC-348 | READ-083 | EP-034 | GET /api/v1/strategies | contract/strategies (planned) |
| TRC-349 | READ-084 | EP-019 | GET /api/v1/strategies/:id | contract/strategy_detail (planned) |
| TRC-350 | READ-085 | EP-035 | GET /api/v1/chains | contract/chains_alias (planned) |
| TRC-351 | READ-086 | EP-035 | GET /api/v1/chains | contract/chains_alias (planned) |
| TRC-352 | READ-087 | EP-032 | GET /api/v1/mode | contract/mode_read (planned) |
| TRC-353 | READ-088 | EP-040 | GET /api/v1/providers | contract/providers (planned) |
| TRC-354 | READ-089 | EP-040 | GET /api/v1/providers | contract/providers (planned) |
| TRC-355 | READ-090 | EP-040 | GET /api/v1/providers | contract/providers (planned) |
| TRC-356 | READ-091 | EP-035 | GET /api/v1/chains | contract/chains_alias (planned) |
| TRC-357 | READ-092 | EP-024 | POST /api/v1/quote | contract/quote (planned) |
| TRC-358 | READ-093 | EP-030 | GET /api/v1/funnel | contract/funnel (planned) |
| TRC-359 | READ-094 | EP-027 | GET /api/v1/audit | contract/audit (planned) |
| TRC-360 | READ-095 | EP-027 | GET /api/v1/audit | contract/audit (planned) |
| TRC-361 | READ-096 | EP-028 | GET /api/v1/system/diagnostics | contract/diagnostics (planned) |
| TRC-362 | READ-097 | EP-041 | GET /api/v1/system/health | contract/system (planned) |
| TRC-363 | READ-098 | none | none | UI-only regression check (planned) |
| TRC-364 | READ-099 | none | none | UI-only regression check (planned) |
| TRC-365 | READ-100 | none | none | UI-only regression check (planned) |
| TRC-366 | READ-101 | none | none | UI-only regression check (planned) |
| TRC-367 | READ-102 | EP-031 | GET /api/v1/status | contract/status (planned) |
| TRC-368 | READ-103 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-369 | READ-104 | EP-033 | GET /api/v1/positions | contract/positions (planned) |
| TRC-370 | READ-105 | EP-041 | GET /api/v1/system/health | contract/system (planned) |
| TRC-371 | READ-106 | EP-041 | GET /api/v1/system/health | contract/system (planned) |
| TRC-372 | READ-107 | EP-041 | GET /api/v1/system/health | contract/system (planned) |
| TRC-373 | READ-108 | EP-041 | GET /api/v1/system/health | contract/system (planned) |
| TRC-374 | READ-109 | EP-034 | GET /api/v1/strategies | contract/strategies (planned) |
| TRC-375 | READ-110 | EP-034 | GET /api/v1/strategies | contract/strategies (planned) |
| TRC-376 | READ-111 | EP-035 | GET /api/v1/chains | contract/chains_alias (planned) |
| TRC-377 | READ-112 | EP-035 | GET /api/v1/chains | contract/chains_alias (planned) |
| TRC-378 | READ-113 | EP-035 | GET /api/v1/chains | contract/chains_alias (planned) |
| TRC-379 | READ-114 | none | none | UI-only regression check (planned) |
| TRC-380 | READ-115 | EP-040 | GET /api/v1/providers | contract/providers (planned) |

The same element ID appears exactly once in this table. A toggle with two actions names both endpoints on that row. A verification target marked planned has no passing test claimed.

## Traced endpoint register

| Endpoint ID | Method and path | Availability | Request | Response |
| --- | --- | --- | --- | --- |
| EP-001 | POST /api/v1/controls/kill-switch | Proposed | { flatten: boolean, request_id? } | Receipt with action `emergency_stop` and details for both `entries_paused` and `live_execution_disarmed` |
| EP-002 | POST /api/v1/controls/pause | Existing | Optional request_id | Receipt |
| EP-003 | POST /api/v1/controls/resume | Existing | Optional request_id | Receipt |
| EP-004 | POST /api/v1/controls/live-execution | Existing | enabled boolean and optional request_id | Receipt |
| EP-005 | POST /api/v1/controls/exits/pause | Proposed | { request_id? } | Receipt |
| EP-006 | POST /api/v1/controls/exits/resume | Proposed | { request_id? } | Receipt |
| EP-007 | POST /api/v1/mode | Existing | config: ModeConfig, required reason, optional request_id | Receipt |
| EP-008 | POST /api/v1/controls/circuit-breaker/reset | Proposed | { request_id? } | Receipt |
| EP-009 | GET /api/v1/trades/export | Proposed | Same filters as TRADES_ALIAS, no cursor | text/csv |
| EP-010 | POST /api/v1/strategies/:id/enable | Existing | Canonical id in path, optional request_id | Receipt |
| EP-011 | POST /api/v1/strategies/:id/disable | Existing | Canonical id in path, optional request_id | Receipt |
| EP-012 | POST /api/v1/controls/chain | Existing, partial | config: ChainRouting; optional request_id | Receipt |
| EP-013 | GET /api/v1/positions/:id | Proposed | Canonical run ID | Position item, nullable exit policy and journal events |
| EP-014 | POST /api/v1/controls/exit | Existing, partial | run_id or chain and canonical token address; optional request_id | Receipt |
| EP-015 | GET /api/v1/trades | Proposed | Same query as TRADES; optional strategy_id for desk filtering | 200 { items: TradeRead[], next_cursor: string or null } |
| EP-016 | GET /api/v1/trades/:id | Proposed | Canonical run ID | TradeRead and audit trail |
| EP-017 | POST /api/v1/controls/risk | Existing, extend write | { config: RiskConfig, limits?, expected_risk_revision?, expected_limits_revision?, request_id? } | Receipt |
| EP-018 | POST /api/v1/controls/trading-limits | Proposed | { daily_entry_limit_usd, per_trade_limit_usd, expected_revision, request_id? } | Receipt |
| EP-019 | GET /api/v1/strategies/:id | Existing phase3 detail; extend projection | Canonical strategy ID | Registry item and nullable recent signals and trades |
| EP-020 | POST /api/v1/strategies/:id/params | Existing, partial | Canonical id, params object, optional request_id | Receipt |
| EP-021 | POST /api/v1/providers/:id/enable | Existing | Canonical id, optional request_id | Receipt |
| EP-022 | POST /api/v1/providers/:id/disable | Existing | Canonical id, optional request_id | Receipt |
| EP-023 | POST /api/v1/controls/providers/order | Proposed | { provider_ids: string[], expected_revision: string, request_id? } | Receipt |
| EP-024 | POST /api/v1/quote | Proposed | { chain, token, side, size_usd, slippage_bps, mev_mode } | 200 QuoteRead |
| EP-025 | POST /api/v1/controls/manual-trade | Proposed, paper | { quote_id, request_id? } | Receipt |
| EP-026 | GET /api/v1/audit/export | Proposed | Same filters as AUDIT, no cursor | application/x-ndjson |
| EP-027 | GET /api/v1/audit | Existing, extend projection | limit 1–200, since ISO, integer cursor | items of JournalEvent and next_cursor |
| EP-028 | GET /api/v1/system/diagnostics | Proposed | None | Status, last 100 events, allow-listed non-secret config |
| EP-029 | GET /api/v1/performance | Proposed | range or since/until | 200 PerformanceRead |
| EP-030 | GET /api/v1/funnel | Proposed | range or since/until | 200 { since, until, counts, reasons, bins } |
| EP-031 | GET /api/v1/status | Existing, extend projection | None | loop_state, last_cycle_at, breaker_open, breaker_until, entries_paused, execution_mode, live_execution_enabled, open_positions, current_equity, drawdown_pct |
| EP-032 | GET /api/v1/mode | Existing | None | ModeConfig |
| EP-033 | GET /api/v1/positions | Existing, extend projection | None | items of journal positions, age_sec, nullable mark and unrealized_pnl_usd |
| EP-034 | GET /api/v1/strategies | Existing, partial | None | items from strategy registry, signals and journal history |
| EP-035 | GET /api/v1/chains | Proposed | Optional range | 200 { items: ChainRead[], config: ChainRouting } |
| EP-036 | GET /api/v1/equity | Existing, partial | None | latest and history of Equity Curve publications |
| EP-037 | GET /api/v1/risk | Existing, partial | None | config, as_of, actor |
| EP-038 | GET /api/v1/trading-limits | Proposed | None | 200 { daily_entry_limit_usd, per_trade_limit_usd, revision } |
| EP-039 | GET /api/v1/receipts/:request_id | Proposed | Request ID in path | 200 Receipt |
| EP-040 | GET /api/v1/providers | Existing, partial | None | items from provider configuration and usage projection |
| EP-041 | GET /api/v1/system/health | Proposed | None | 200 SystemRead |

## Receipt guarantees

Newly queued commands return HTTP 202. Receipt lookup, idempotent replay and quote preview return HTTP 200. A replay always returns the original `request_id`, including while the command is queued. Conflicting reuse returns HTTP 409.
