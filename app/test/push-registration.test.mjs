import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pushState,enablePush} from '../src/lib/push.ts'
const key='AQID'
function setup(t,{registered=true,saveFails=false,ready=true,wrongKey=false}={}){
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator')
 const calls=[]
 const subscription={options:{applicationServerKey:new Uint8Array(wrongKey?[4,5,6]:[1,2,3]).buffer},toJSON:()=>({endpoint:'https://example.test/sub',keys:{p256dh:'fictional-key',auth:'fictional-auth'}}),unsubscribe:async()=>{calls.push('unsubscribe');return true}}
 const reg={active:{},pushManager:{getSubscription:async()=>subscription,subscribe:async()=>subscription}}
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Android',platform:'Linux',serviceWorker:{getRegistration:async()=>ready?reg:null,ready:Promise.resolve(reg)}},configurable:true})
 globalThis.window={PushManager:{},Notification:{},matchMedia:()=>({matches:false})}
 globalThis.Notification={permission:'granted',requestPermission:async()=>{calls.push('permission');return 'granted'}}
 const api={rpc:async(name)=>{
  calls.push(name)
  if(name==='push_public_key')return {data:key,error:null}
  if(name==='push_subscription_registered')return {data:registered,error:null}
  if(name==='save_push_subscription')return {data:null,error:saveFails?new Error('private diagnostic'):null}
  throw new Error('Unexpected RPC')
 }}
 t.after(()=>{if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;delete globalThis.window;delete globalThis.Notification})
 return {api,calls}
}
test('browser permission and subscription alone cannot report on',async t=>{const {api}=setup(t,{registered:false});assert.equal(await pushState(api),'repair')})
test('registration confirmed for this account reports on',async t=>{const {api}=setup(t);assert.equal(await pushState(api),'on')})
test('failed backend save remains repairable without leaking backend error',async t=>{const {api}=setup(t,{registered:false,saveFails:true});await assert.rejects(enablePush(api),/registration was not confirmed/);assert.equal(await pushState(api),'repair')})
test('wrong VAPID key needs repair even with a server row',async t=>{const {api}=setup(t,{wrongKey:true});assert.equal(await pushState(api),'repair')})
test('worker activation race waits for ready instead of unsupported',async t=>{const {api}=setup(t,{ready:false});assert.equal(await pushState(api),'on')})
test('permission is requested before network awaits',async t=>{const {api,calls}=setup(t);Notification.permission='default';await enablePush(api);assert.equal(calls[0],'permission')})
test('backend confirmation failure cannot report on after a successful save',async t=>{const {api}=setup(t,{registered:false});await assert.rejects(enablePush(api),/registration was not confirmed/)})
