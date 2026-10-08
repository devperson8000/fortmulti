"""Decode Godot's verified RSCC/Zstandard resource; no Godot native plug-in required."""
import sys,struct,ctypes,ctypes.util,hashlib
if len(sys.argv)!=3:raise SystemExit('Usage: python scripts/map-assets/unpack-terrain.py terrain3d_00_00.res terrain-uncompressed.res')
p=open(sys.argv[1],'rb').read()
expected='bf6881fdff855d0cdf084ceee601f897411c5b1c958a59603f957b931678eaf6'
if hashlib.sha256(p).hexdigest()!=expected:raise SystemExit('Terrain3D resource checksum mismatch')
if p[:4]!=b'RSCC':raise SystemExit('Unexpected resource format')
mode,block,size=struct.unpack_from('<III',p,4)
if mode!=2 or block!=4096:raise SystemExit('Unexpected Godot compression')
n=size//block+1;lengths=struct.unpack_from('<'+'I'*n,p,16);pos=16+4*n
lib=ctypes.CDLL(ctypes.util.find_library('zstd'));lib.ZSTD_decompress.argtypes=[ctypes.c_void_p,ctypes.c_size_t,ctypes.c_void_p,ctypes.c_size_t];lib.ZSTD_decompress.restype=ctypes.c_size_t
out=bytearray()
for length in lengths:
 dest=ctypes.create_string_buffer(block);src=p[pos:pos+length];pos+=length;result=lib.ZSTD_decompress(dest,block,src,length)
 if result>block:raise SystemExit('Invalid compressed terrain block')
 out+=dest.raw[:result]
if len(out)!=size or out[612:620]!=struct.pack('<II',31,4194304):raise SystemExit('Unexpected height image layout')
open(sys.argv[2],'wb').write(out)
