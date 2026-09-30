const nextCapacity=value=>{let capacity=16;while(capacity<value)capacity*=2;return capacity;};

// Keeps the large dynamic geometry allocation alive across frames. Only the view is
// recreated, avoiding multi-megabyte Float32Array garbage and the GC stalls it caused.
export class ReusableFloatBuffer{
 constructor(initialCapacity=0){this.buffer=new Float32Array(nextCapacity(Math.max(1,initialCapacity)));this.length=0;this.allocations=1;}
 get capacity(){return this.buffer.length;}
 ensure(length){if(length<=this.capacity)return;this.buffer=new Float32Array(nextCapacity(length));this.allocations++;}
 copy(values){const length=Math.max(0,Number(values?.length)||0);this.ensure(length);this.buffer.set(values,0);this.length=length;return this.buffer.subarray(0,length);}
}
