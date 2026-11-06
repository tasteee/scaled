import * as hostModule from './nativeExpressionHost.mjs'
const host = hostModule.createNativeExpressionHost()
const lookup = host.koffi.proto('void *InspectGrooveExpression(void *output, void *key)')
for (const identifier of ['a1384322-12cc-4bf8-a1e4-2b3ca67f04f6','03f9a541-d310-4563-a364-614dbf478441']) {
const key=Buffer.from(identifier.replaceAll('-',''),'hex')
const output=Buffer.alloc(16)
host.koffi.call(host.pluginBase+0x812820n,lookup,output,key)
const expression=output.readBigUInt64LE(0)
const begin=host.readPointer(expression+0x40n)
const end=host.readPointer(expression+0x48n)
const values=Array.from(host.koffi.decode(begin,'int',Number((end-begin)/4n)))
console.log(identifier,values)
}
host.close()
process.exit(0)
