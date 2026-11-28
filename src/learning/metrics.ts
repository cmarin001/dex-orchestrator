export type Trade = { pnlCents:number; costCents:number; openedAt:number; closedAt:number };
const mean=(values:readonly number[])=>values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null;

export function performanceSummary(trades:readonly Trade[],startingCents:number) {
  if (!Number.isSafeInteger(startingCents) || startingCents<=0) throw new RangeError("Invalid starting capital");
  let equity=startingCents,peak=startingCents,drawdown=0;
  const returns:number[]=[], wins:number[]=[], losses:number[]=[];
  let turnoverCents=0;
  for (const trade of [...trades].sort((a,b)=>a.closedAt-b.closedAt)) {
    if (!Number.isSafeInteger(trade.costCents) || trade.costCents<=0 ||
        !Number.isSafeInteger(trade.pnlCents) || trade.pnlCents< -trade.costCents ||
        !Number.isSafeInteger(trade.openedAt) || !Number.isSafeInteger(trade.closedAt) || trade.closedAt<trade.openedAt) {
      throw new RangeError("Invalid trade");
    }
    equity+=trade.pnlCents;
    peak=Math.max(peak,equity);
    drawdown=Math.max(drawdown,(peak-equity)/peak);
    turnoverCents+=trade.costCents+(trade.costCents+trade.pnlCents);
    returns.push(trade.pnlCents/trade.costCents);
    if (trade.pnlCents>0) wins.push(trade.pnlCents);
    if (trade.pnlCents<0) losses.push(trade.pnlCents);
  }
  const averageReturn=mean(returns);
  const deviation=averageReturn===null ? null : Math.sqrt(mean(returns.map(value=>(value-averageReturn)**2))!);
  return {trades:trades.length,netCents:equity-startingCents,netReturn:(equity-startingCents)/startingCents,
    maxRealizedDrawdown:drawdown,profitFactor:losses.length ? wins.reduce((a,b)=>a+b,0)/Math.abs(losses.reduce((a,b)=>a+b,0)) : null,
    expectedCentsPerTrade:mean(trades.map(row=>row.pnlCents)),winRate:trades.length?wins.length/trades.length:null,
    averageWinCents:mean(wins),averageLossCents:mean(losses),turnoverCents,
    averageHoldMs:mean(trades.map(row=>row.closedAt-row.openedAt)),
    meanReturnToVolatility:deviation ? averageReturn!/deviation : null};
}
