import strategy0 from "./builtin/breakout-15m.js";
import strategy1 from "./builtin/mean-revert-1h.js";
import strategy2 from "./builtin/volume-spike.js";
import strategy3 from "./builtin/liquidity-influx.js";
import strategy4 from "./builtin/holder-growth.js";
import strategy5 from "./builtin/whale-accum.js";
import strategy6 from "./builtin/new-pair-momentum.js";
import strategy7 from "./builtin/dip-buy.js";
import strategy8 from "./builtin/range-breakout.js";
import strategy9 from "./builtin/rsi-oversold-5m.js";
import strategy10 from "./builtin/momentum-ladder.js";
import strategy11 from "./builtin/liq-drain-exit.js";
import strategy12 from "./builtin/honeypot-recheck.js";
import strategy13 from "./builtin/session-aware.js";
import strategy14 from "./builtin/gas-aware.js";
import strategy15 from "./builtin/btc-correlation.js";
import strategy16 from "./builtin/new-pool-snipe.js";
import strategy17 from "./builtin/vol-mcap-ratio.js";
import strategy18 from "./builtin/holder-conc-drop.js";
import strategy19 from "./builtin/multi-signal-consensus.js";
import strategy20 from "./builtin/anti-signal.js";
import strategy21 from "./builtin/kelly-fraction.js";
import strategy22 from "./builtin/time-of-day.js";
import strategy23 from "./builtin/copy-trade.js";

import type { Strategy } from "./strategy.js";
import earlyMomentum from "./builtin/early-momentum-reversal.js";

export const builtins: Strategy[] = [strategy0, strategy1, strategy2, strategy3, strategy4, strategy5, strategy6, strategy7, strategy8, strategy9, strategy10, strategy11, strategy12, strategy13, strategy14, strategy15, strategy16, strategy17, strategy18, strategy19, strategy20, strategy21, strategy22, strategy23, earlyMomentum];
