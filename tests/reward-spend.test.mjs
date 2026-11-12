import test from 'node:test';
import assert from 'node:assert/strict';
import {canSpend,assertSpendable} from '../src/reward-spend.mjs';

const reward={balance:'100',available:'100',pending:false,resets_at:'1794585600000'};

test('exhausted weekly allowance blocks a wallet transaction',()=>{
  const exhausted={...reward,available:'0'};
  assert.equal(canSpend(exhausted),false);
  assert.throws(()=>assertSpendable(exhausted,1n),/Weekly limit reached/);
});

test('preflight rejects amounts above the latest allowance and pending spends',()=>{
  assert.throws(()=>assertSpendable(reward,101n),/exceeds what is available/);
  assert.throws(()=>assertSpendable({...reward,pending:true},1n),/pending/);
  assert.throws(()=>assertSpendable({...reward,balance:'0',available:'0'},1n),/no remaining balance/);
  assert.equal(canSpend(reward),true);
  assert.doesNotThrow(()=>assertSpendable(reward,100n));
});
