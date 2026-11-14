"use strict";

globalThis.Valley = (() => {
  const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const plus = (a, b) => a.map((v, i) => v + b[i]);
  const minus = (a, b) => a.map((v, i) => v - b[i]);
  const times = (a, n) => a.map(v => v * n);
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  const unit = v => times(v, 1 / (Math.hypot(...v) || 1));
  const white = [1, 1, 1];
  const whiteMesh = [1, 1, 1, 1];
  const rgb = hex => [(hex >> 16) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const waterRipples = { limit:28, life:3.8, origin:.11, speed:1.42, boost:.71 };
  const cutoutLayout = { slots:5 };

  function setFrustum(planes,vp) {
    let i=0;
    for(let row=0;row<3;row++) for(const sign of [-1,1]) {
      const x=vp[3]+sign*vp[row], y=vp[7]+sign*vp[row+4], z=vp[11]+sign*vp[row+8];
      const scale=1/Math.hypot(x,y,z);
      planes[i++]=x*scale;
      planes[i++]=y*scale;
      planes[i++]=z*scale;
      planes[i++]=(vp[15]+sign*vp[row+12])*scale;
    }
  }

  function visibleBounds(bounds,planes) {
    if(!bounds) return true;
    const {min,max}=bounds;
    for(let i=0;i<planes.length;i+=4) {
      const x=planes[i], y=planes[i+1], z=planes[i+2];
      if(x*(x<0 ? min[0] : max[0])+y*(y<0 ? min[1] : max[1])+z*(z<0 ? min[2] : max[2])+planes[i+3]<-.0001) return false;
    }
    return true;
  }

  function random(seed) {
    return () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function multiply(a, b, m = new Float32Array(16)) {
    for (let c = 0; c < 16; c += 4) {
      for (let r = 0; r < 4; r++) {
        m[c+r] = a[r]*b[c] + a[r+4]*b[c+1] + a[r+8]*b[c+2] + a[r+12]*b[c+3];
      }
    }
    return m;
  }

  function transform(at, pitch = 0, yaw = 0, roll = 0, size = 1) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    return new Float32Array([
      (cy*cr + sy*sp*sr)*size, cp*sr*size, (-sy*cr + cy*sp*sr)*size, 0,
      (-cy*sr + sy*sp*cr)*size, cp*cr*size, (sy*sr + cy*sp*cr)*size, 0,
      sy*cp*size, -sp*size, cy*cp*size, 0,
      ...at, 1
    ]);
  }

  function direction(m, [x, y, z]) {
    return [m[0]*x + m[4]*y + m[8]*z, m[1]*x + m[5]*y + m[9]*z, m[2]*x + m[6]*y + m[10]*z];
  }
  const point = (m, v) => plus(direction(m, v), [m[12], m[13], m[14]]);

  function camera(at, yaw, pitch, fov, aspect, roll = 0) {
    const toWorld = transform(at, pitch, -yaw, roll);
    const right = [toWorld[0], toWorld[1], toWorld[2]];
    const up = [toWorld[4], toWorld[5], toWorld[6]];
    const back = [toWorld[8], toWorld[9], toWorld[10]];
    const view = new Float32Array([
      right[0], up[0], back[0], 0, right[1], up[1], back[1], 0, right[2], up[2], back[2], 0,
      -dot(right, at), -dot(up, at), -dot(back, at), 1
    ]);
    const near = 0.045, far = 850;
    const half = Math.tan(fov * Math.PI / 360);
    const projection = new Float32Array([
      1 / (half * aspect), 0, 0, 0, 0, 1 / half, 0, 0,
      0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0
    ]);
    return {
      at, toWorld, projection, vp: multiply(projection, view), forward: times(back, -1),
      axes: new Float32Array([...right, ...up, ...times(back, -1)]), frustum: [half * aspect, half]
    };
  }

  class Builder {
    vertices = [];
    indices = [];

    vertex(p, n = [0, 1, 0], uv = [0, 0], tint = white) {
      const index = this.vertices.length / 11;
      this.vertices.push(...p, ...n, ...uv, ...tint);
      return index;
    }

    triangle(a, b, c, tint = white) {
      const n = unit(cross(minus(b, a), minus(c, a)));
      this.indices.push(...[a,b,c].map(p => this.vertex(p, n, [0,0], tint)));
    }

    quad(points, tint = white, normal = null, uvs = [[0,0],[1,0],[1,1],[0,1]]) {
      const n = normal || unit(cross(minus(points[1], points[0]), minus(points[2], points[0])));
      const [a,b,c,d] = points.map((p, i) => this.vertex(p, n, uvs[i], tint));
      this.indices.push(a, b, c, a, c, d);
    }

    box(center, size, tint = white, radius = 0, rotation = null, segments = 1) {
      const half = times(size, .5);
      const r = Math.min(radius, ...half);
      const longAxis = segments>1 ? size.indexOf(Math.max(...size)) : -1;
      const stops = axis => {
        const h=half[axis], inner=h-r, count=axis===longAxis ? segments : 1;
        const row=Array.from({length:count+1},(_,i)=>mix(-inner,inner,i/count));
        return r ? [-h,...row,h] : row;
      };
      const orient = rotation ? transform(center, ...rotation) : null;
      for (let axis = 0; axis < 3; axis++) {
        const u = (axis + 1) % 3, v = (axis + 2) % 3;
        const us = stops(u), vs = stops(v);
        for (const sign of [-1, 1]) {
          const rows = vs.map((vv, j) => us.map((uu, i) => {
            let p = [0, 0, 0];
            p[axis] = sign * half[axis]; p[u] = uu; p[v] = vv;
            let n = [0, 0, 0];
            n[axis] = sign;
            if (r) {
              const inside = p.map((value, k) => clamp(value, -half[k]+r, half[k]-r));
              n = unit(minus(p, inside));
              p = plus(inside, times(n, r));
            }
            return this.vertex(orient ? point(orient, p) : plus(center, p),
              orient ? direction(orient, n) : n, [i/(us.length-1), j/(vs.length-1)], tint);
          }));
          for (let j = 1; j < vs.length; j++) {
            for (let i = 1; i < us.length; i++) {
              const a = rows[j-1][i-1], b = rows[j-1][i], c = rows[j][i], d = rows[j][i-1];
              this.indices.push(...(sign > 0 ? [a,b,c,a,c,d] : [a,c,b,a,d,c]));
            }
          }
        }
      }
    }

    cylinder(a, b, ra, rb, tint = white, sides = 10, caps = true, segments = 1) {
      const axis = unit(minus(b, a));
      const u = unit(cross(axis, Math.abs(axis[1]) > .9 ? [1,0,0] : [0,1,0]));
      const v = cross(axis, u);
      const sidesAt = [], normals = [], slope = (ra-rb)/Math.max(.0001,Math.hypot(...minus(b,a)));
      for (let i = 0; i <= sides; i++) {
        const phase = 2 * Math.PI * i / sides;
        const n = plus(times(u, Math.cos(phase)), times(v, Math.sin(phase)));
        sidesAt.push(n);
        normals.push(unit(plus(n,times(axis,slope))));
      }
      let lower = null;
      for(let j=0;j<=segments;j++) {
        const t=j/segments, center=a.map((x,i)=>mix(x,b[i],t)), radius=mix(ra,rb,t);
        const upper=sidesAt.map((n,i)=>this.vertex(plus(center,times(n,radius)),normals[i],[i/sides,t],tint));
        if(lower) for(let i=0;i<sides;i++) this.indices.push(lower[i],lower[i+1],upper[i+1],lower[i],upper[i+1],upper[i]);
        lower=upper;
      }
      if (!caps) return;
      for (const [center, radius, normal] of [[a, ra, times(axis,-1)], [b, rb, axis]]) {
        const root = this.vertex(center, normal, [.5,.5], tint);
        const rim = [];
        for (let i = 0; i < sides; i++) {
          const phase = 2 * Math.PI * i / sides;
          const x = Math.cos(phase), y = Math.sin(phase);
          rim.push(this.vertex(plus(center, plus(times(u, radius*x), times(v, radius*y))), normal, [.5+x*.5,.5+y*.5], tint));
        }
        for (let i = 0; i < sides; i++) this.indices.push(root, rim[i], rim[(i+1)%sides]);
      }
    }

    ellipsoid(center, size, tint = white, rotation = null, slices = 14, rings = 9) {
      const orient = rotation ? transform(center, ...rotation) : null;
      const base = this.vertices.length / 11;
      for (let j = 0; j <= rings; j++) {
        const angle = Math.PI * j / rings;
        for (let i = 0; i <= slices; i++) {
          const phase = 2 * Math.PI * i / slices;
          const v = [Math.sin(angle)*Math.cos(phase), Math.cos(angle), Math.sin(angle)*Math.sin(phase)];
          const p = v.map((n, k) => n * size[k]);
          const n = unit(v.map((value, k) => value / size[k]));
          this.vertex(orient ? point(orient, p) : plus(center, p),
            orient ? direction(orient, n) : n, [i/slices, 1-j/rings], tint);
        }
      }
      for (let j = 0; j < rings; j++) {
        for (let i = 0; i < slices; i++) {
          const a = base + j*(slices+1) + i, b = a + slices + 1;
          this.indices.push(a, b, a+1, a+1, b, b+1);
        }
      }
    }
  }

  const screenVertex = `#version 300 es
    out vec2 uv;
    void main() {
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      uv = p;
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`;

  const meshInputs = `
    layout(location=0) in vec3 aPosition;
    layout(location=1) in vec3 aNormal;
    layout(location=2) in vec2 aUV;
    layout(location=3) in vec3 aTint;
    layout(location=4) in vec3 aDisplacement;
    layout(location=5) in vec2 aDamageUV;
  `;

  const hashGLSL = `
    float hash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * .1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+1.0),f.x), f.y);
    }`;

  const skyFragment = `#version 300 es
    precision highp float;
    in vec2 uv;
    out vec4 pixel;
    uniform mat3 uAxes;
    uniform vec2 uFrustum;
    uniform float uTime;
    uniform float uMirror;
    uniform float uSubmerged;
    ${hashGLSL}
    void main() {
      vec3 d = normalize(uAxes * vec3((uv*2.0-1.0)*uFrustum, 1.0));
      d.y *= uMirror;
      vec3 sky = mix(vec3(.929,.939,.947), vec3(.74,.81,.87), smoothstep(-.02,.82,d.y));
      vec2 p = d.xz / max(.16, .24+d.y) * 3.0 + vec2(uTime*.007, .7);
      float clouds = noise(p)*.65 + noise(p*2.07)*.24 + noise(p*4.21)*.11;
      sky = mix(sky, vec3(.973,.969,.944), smoothstep(.33,.75,clouds)*.73);
      float glare = pow(max(0.0,dot(d, normalize(vec3(-.57,.69,-.43)))), 10.0);
      sky += vec3(.10,.082,.045)*glare;
      vec3 water = mix(vec3(.126,.177,.125),vec3(.36,.41,.28),smoothstep(-.62,.78,d.y));
      pixel = vec4(mix(sky,water,uSubmerged), 1);
    }`;

  const meshStyle = canopy => canopy ? `
    const highp int uMaterial = 4;
    const vec4 uProp = vec4(0.0);` : `
    uniform highp int uMaterial;
    uniform vec4 uProp;`;

  const maxSkinJoints = 128;
  const meshVertex = (canopy = false, skinned = false) => `#version 300 es
    precision highp float;
    ${meshInputs}
    ${skinned ? `
      layout(location=6) in uvec4 aJoints;
      layout(location=7) in vec4 aWeights;
      layout(std140) uniform JointPalette { mat4 uJoints[${maxSkinJoints}]; };
    ` : ""}
    ${meshStyle(canopy)}
    ${canopy ? "const mat4 uModel = mat4(1.0);" : "uniform mat4 uModel;"}
    uniform mat4 uVP;
    uniform float uTime;
    uniform vec3 uEye;
    uniform vec4 uTubeShape;
    uniform vec4 uDentAnchors[2];
    uniform vec4 uDentPressure[2];
    uniform vec3 uSleeve[5];
    uniform bool uArmIK;
    out vec3 vP;
    out vec3 vNormal;
    out vec3 vLocal;
    out vec2 vUV;
    out vec2 vDamageUV;
    out vec3 vTint;
    void main() {
      vec3 local = aPosition + aDisplacement;
      vec3 normal = aNormal;
      if (uMaterial == 16) {
        float t = aPosition.z, r = 1.0-t;
        vec3 center = r*r*r*uSleeve[0]+3.0*r*r*t*uSleeve[1]+3.0*r*t*t*uSleeve[2]+t*t*t*uSleeve[3];
        vec3 slope = r*r*(uSleeve[1]-uSleeve[0])+2.0*r*t*(uSleeve[2]-uSleeve[1])+t*t*(uSleeve[3]-uSleeve[2]);
        if (uArmIK) {
          vec3 upper = uSleeve[1]-uSleeve[0], fore = uSleeve[3]-uSleeve[1];
          vec3 bend = normalize(upper)+normalize(fore);
          if (dot(bend,bend)<.001) bend=normalize(fore);
          bend *= .31*min(length(upper),length(fore));
          bool shoulder = t<.5;
          vec3 a = shoulder ? uSleeve[0] : uSleeve[1];
          vec3 b = shoulder ? uSleeve[0]+upper*.33 : uSleeve[1]+bend;
          vec3 c = shoulder ? uSleeve[1]-bend : uSleeve[2];
          vec3 d = shoulder ? uSleeve[1] : uSleeve[3];
          float s = shoulder ? t*2.0 : (t-.5)*2.0, v = 1.0-s;
          center = v*v*v*a+3.0*v*v*s*b+3.0*v*s*s*c+s*s*s*d;
          slope = v*v*(b-a)+2.0*v*s*(c-b)+s*s*(d-c);
        }
        vec3 tangent = normalize(slope);
        vec3 width = mix(vec3(1.0,0.0,0.0),uSleeve[4],smoothstep(.57,1.0,t));
        width -= tangent*dot(width,tangent);
        if (dot(width,width)<.001) width=cross(tangent,abs(tangent.y)<.8 ? vec3(0.0,1.0,0.0) : vec3(0.0,0.0,1.0));
        width = normalize(width);
        vec3 depth = cross(tangent,width);
        local = center+aPosition.x*width+aPosition.y*depth;
        normal = normalize(aNormal.x*width+aNormal.y*depth);
      }
      if (uProp.x > .5 && uProp.x < 2.5) {
        bool tent = uProp.x < 1.5;
        float panel = sin(clamp(aUV.x/(tent ? 1.9 : 1.3),0.0,1.0)*3.141593);
        float radius = length(local.xz);
        float slack = tent ? smoothstep(.06,.75,local.y)*smoothstep(.06,.54,radius) : smoothstep(.15,1.05,radius);
        float wind = sin(uTime*2.2+local.x*4.4+local.z*3.3+uProp.y);
        wind = wind*.067 + sin(uTime*4.7-local.z*7.1+local.x*4.0)*.027;
        local += aNormal*wind*slack*panel*uProp.z;
      } else if (uProp.x > 2.5 && uProp.x < 3.5) {
        float fold = .70*sin(aPosition.x*17.1+aPosition.z*11.3)*cos(aPosition.z*13.7-aPosition.x*8.1)
                   + .30*sin(aPosition.z*29.8-aPosition.x*17.6);
        float slack = uTubeShape.w;
        local.xz *= 1.0+((1.0-uProp.z)*.036+slack*.012)*fold;
        local.y += ((1.0-uProp.z)*.076+slack*.048)*fold;
        float scaleY = max(.10,length(uModel[1].xyz));
        float span = clamp((.52-aPosition.z/uTubeShape.x)/1.51,0.0,1.0);
        float hang = span*span*(3.0-2.0*span)*uTubeShape.y;
        float flutter = sin(uTime*5.5+aPosition.x*7.7-aPosition.z*4.8+uProp.y);
        float pullX = .037*flutter-.37*local.x;
        float pullY = -(.46+.036*flutter+.037*fold)/scaleY;
        float pullZ = uTubeShape.x*.54;
        local += vec3(pullX,pullY,pullZ)*hang;
        float slope = -6.0*span*(1.0-span)*uTubeShape.y/(1.51*uTubeShape.x);
        normal.x /= 1.0-.37*hang;
        normal.z = (normal.z-slope*(pullX*normal.x+pullY*normal.y))/(1.0+pullZ*slope);
        normal /= vec3(dot(uModel[0].xyz,uModel[0].xyz),dot(uModel[1].xyz,uModel[1].xyz),dot(uModel[2].xyz,uModel[2].xyz));
        float spread = uTubeShape.z;
        float edge = smoothstep(.36,.99,length(aPosition.xz)/uTubeShape.x);
        local.xz *= 1.0+spread*(.057+.034*fold);
        local.y += edge*spread*(.028+.063*max(0.0,flutter))/scaleY;
      }
      if (mod(uProp.w,4.0) > .5) {
        for (int i=0; i<2; i++) {
          vec4 anchor = uDentAnchors[i], press = uDentPressure[i];
          if (anchor.w > .001) {
            float dent = 1.0-smoothstep(0.0,anchor.w,length(aPosition-anchor.xyz));
            local -= press.xyz*press.w*dent*dent;
          }
        }
      }
      ${skinned ? `
        mat4 skin = aWeights.x*uJoints[aJoints.x] + aWeights.y*uJoints[aJoints.y]
                  + aWeights.z*uJoints[aJoints.z] + aWeights.w*uJoints[aJoints.w];
        local = (skin*vec4(local,1.0)).xyz;
        mat3 basis = mat3(skin);
        normal = abs(determinant(basis))>.00001 ? transpose(inverse(basis))*normal : basis*normal;
      ` : ""}
      vec4 p = uModel * vec4(local,1.0);
      if (uMaterial == 4) {
        float taper = sin(aUV.y * 1.36);
        p.x += sin(uTime*1.4+p.z*.23+p.x*.14)*.085*taper;
        p.z += cos(uTime*.87+p.x*.14)*.06*taper;
      }
      if (uMaterial == 5) {
        vec2 away = p.xz-uEye.xz;
        float d = length(away), stem = aUV.y*aUV.y;
        float brush = (1.0-smoothstep(.13,.71,d))*stem;
        p.xz += vec2(sin(uTime*2.38+p.z*.56),cos(uTime*1.5+p.x*.53))*.061*stem;
        p.xz += away/max(.06,d)*brush*.19;
        p.y -= brush*.086;
      }
      vP = p.xyz;
      vLocal = aPosition;
      vNormal = mat3(uModel) * normal;
      vUV = aUV;
      vDamageUV = aDamageUV;
      vTint = aTint;
      gl_Position = uVP * p;
    }`;

  const meshFragment = (canopy = false) => `#version 300 es
    precision highp float;
    ${meshStyle(canopy)}
    in vec3 vP;
    in vec3 vNormal;
    in vec3 vLocal;
    in vec2 vUV;
    in vec2 vDamageUV;
    in vec3 vTint;
    out vec4 pixel;
    uniform vec3 uEye;
    ${canopy ? "const vec4 uColor = vec4(1.0);" : "uniform vec4 uColor;"}
    uniform float uTime;
    uniform float uBelt;
    uniform vec4 uHoles[${cutoutLayout.slots}];
    uniform sampler2D uClothMask;
    uniform int uReflect;
    ${canopy ? "const int uHand = 0;" : "uniform int uHand;"}
    uniform int uRoomCount;
    uniform vec4 uRoomData[10];
    uniform vec4 uRoomBounds[10];
    uniform float uSubmerged;
    uniform sampler2D uSand;
    uniform sampler2D uStone;
    uniform sampler2D uBark;
    uniform sampler2D uLeaves;
    uniform sampler2D uFabric;
    uniform sampler2D uVinyl;
    uniform sampler2D uSkin;
    uniform sampler2D uPlastic;
    uniform sampler2D uRoadLabels;
    uniform sampler2D uCctv;
    uniform int uCctvChannel;
    uniform sampler2D uLobbyPrint;
    uniform vec4 uBlastLight;
    ${hashGLSL}

    vec3 rock(vec3 p, vec3 n) {
      vec3 w = pow(abs(n), vec3(3.0));
      w /= max(.01, w.x+w.y+w.z);
      return texture(uStone,p.zy*.56).rgb*w.x + texture(uStone,p.xz*.56).rgb*w.y + texture(uStone,p.xy*.56).rgb*w.z;
    }

    float cameraStamp(vec2 uv) {
      vec2 p=(uv-vec2(.05,.875))*vec2(160.0,120.0);
      if(p.x<0.0 || p.x>=24.0 || p.y<0.0 || p.y>=5.0) return 0.0;
      ivec2 cell=ivec2(p);
      int col=cell.x%4, letter=cell.x/4;
      if(col==3) return 0.0;
      const int glyphs[7]=int[7](31015,11245,24557,0,31599,11415,29671);
      int symbol=letter==5 ? 4+uCctvChannel : letter;
      return float((glyphs[symbol] >> (cell.y*3+2-col)) & 1);
    }

    void main() {
      if (uReflect == 1 && vP.y < -.045) discard;
      vec3 n = normalize(vNormal);
      if (uProp.x > .5) {
        vec3 facet = normalize(cross(dFdx(vP),dFdy(vP)));
        float faceting = uProp.x > 2.5 && uProp.x < 3.5 ? .29 : .53;
        n = normalize(mix(n,facet*(dot(n,facet)<0.0 ? -1.0 : 1.0),faceting));
      }
      vec3 light = uHand == 1 ? normalize(vec3(-.4,.86,-.27)) : normalize(vec3(-.57,.69,-.43));
      vec3 toward = normalize(uEye-vP);
      float diffuse = max(0.0, dot(n,light));
      float ambient = .68 + .13*max(n.y,0.0);
      vec3 c = vTint * uColor.rgb;
      float opacity = uColor.a;
      if(uMaterial == 33) {
        vec2 edge=vUV*2.0-1.0;
        float line=.90+.10*cos(vUV.y*1130.97);
        float grain=hash(floor(vUV*vec2(240,180))+floor(uTime*18.0));
        float vignette=1.0-.22*dot(edge,edge)*.5;
        float gray=.018+grain*.010;
        if(uCctvChannel>0) {
          vec2 uv=vUV+edge*dot(edge,edge)*.014;
          uv.x+=.0017*sin(vUV.y*83.0+uTime*5.0);
          gray=.045+.80*dot(texture(uCctv,uv).rgb,vec3(.299,.587,.114))+.051*(grain-.5);
          gray=mix(gray,.88,cameraStamp(vUV));
        }
        float glare=pow(max(0.0,dot(n,normalize(light+toward))),44.0);
        pixel=vec4(vec3(.87,.99,.94)*gray*line*vignette+vec3(.09)*glare,1);
        return;
      }
      float fray = 0.0;
      if (mod(uProp.w,4.0) > 1.5) {
        if (vDamageUV.x >= 0.0) {
          if (texture(uClothMask,vDamageUV).r > .5) discard;
          float rim = max(max(textureOffset(uClothMask,vDamageUV,ivec2(-2,0)).r,
                              textureOffset(uClothMask,vDamageUV,ivec2(2,0)).r),
                          max(textureOffset(uClothMask,vDamageUV,ivec2(0,-2)).r,
                              textureOffset(uClothMask,vDamageUV,ivec2(0,2)).r));
          fray = rim*(.46+.54*noise(vLocal.xz*184.0+vLocal.xy*173.0));
        }
      } else if (mod(uProp.w,4.0) > .5) {
        for (int i=0; i<${cutoutLayout.slots}; i++) {
          vec4 hole = uHoles[i];
          if (hole.w <= .001) continue;
          vec3 offset = vLocal-hole.xyz;
          float d = length(offset);
          if (d > hole.w*1.40) continue;
          float ragged = (.77+.28*noise(vLocal.xz*96.0+vLocal.xy*76.0))*hole.w;
          if (d < ragged) discard;
          fray = max(fray,1.0-smoothstep(ragged,ragged+hole.w*.23,d));
        }
      }

      if (uMaterial == 1) {
        float wet = 1.0-smoothstep(-.11,.34,vP.y);
        vec2 bend = vec2(sin(vP.z*5.4-uTime*1.9),sin(vP.x*4.1+uTime*2.3))*.014;
        vec2 grain = vP.xz*.55+bend*step(vP.y,-.004);
        vec3 fine = texture(uSand,grain).rgb;
        vec3 coarse = texture(uSand,vec2(grain.y,-grain.x)*.78+vec2(.27,.53)).rgb;
        float grainBlend = noise(vP.xz*.36);
        vec3 sand = mix(fine,coarse,smoothstep(.24,.76,grainBlend)*.70);
        float mottling = noise(vP.xz*.29)*.20+.91;
        vec3 ground = sand * vec3(1.09,1.065,1.015) * mottling;
        if (vUV.x > .001) {
          float shade = .59+.22*noise(vP.xz*.17)+.19*grainBlend;
          vec2 litterUV = vP.xz*vec2(13.1,22.4);
          float chaff = smoothstep(.58,.79,noise(litterUV + .29*vP.y));
          float loam = dot(sand,vec3(.299,.587,.114));
          vec3 soil = mix(vec3(.153,.104,.068),vec3(.446,.331,.213),loam);
          float mulch = noise(vP.xz*vec2(2.81,4.76))*.18;
          soil = (soil+vec3(.113,.075,.039)*(chaff+mulch))*shade;
          ground = mix(ground,soil,vUV.x);
        }
        c *= ground;
        if (wet > .001) {
          c *= mix(vec3(1.0),vec3(.70,.71,.61),wet);
          if (vP.y < 0.0) {
            vec2 p = vP.xz;
            float a = sin(p.x*6.3+p.y*4.0 + sin(p.y*7.1+uTime*1.8)*1.6-uTime);
            float b = sin(p.y*7.0-p.x*3.3+sin(p.x*5.0-uTime)*1.8+uTime*1.3);
            float caustic = pow(1.0-abs(a*b), 12.0)*.17*exp(vP.y*mix(1.70,.59,uSubmerged));
            c += vec3(.89,.87,.59)*caustic;
          }
        }
        c *= ambient + diffuse*.34;
      } else if (uMaterial == 2) {
        float stratum = .88 + .22*noise(vec2(vP.y*2.1 + vP.z*.12, vP.x*.2));
        float stain = smoothstep(.51,.80,noise(vP.xz*.32 + vP.y*.18));
        float lichen = smoothstep(.52,.78,noise(vP.xz*.64+vec2(vP.y*.41)))*(.27+.73*max(n.y,0.0));
        c *= rock(vP,n)*stratum*mix(vec3(1.07,1.01,.99),vec3(.58,.69,.47),stain*.37+lichen*.38);
        float fault = smoothstep(.77,.88,noise(vec2(vP.z*3.8+vP.x*2.1 + .14*sin(vP.y*2.3),vP.y*.39)));
        float seam = 1.0-smoothstep(.018,.073,abs(fract(vP.y*2.61+vP.x*.103+vP.z*.077+stratum*.46)-.50));
        seam *= (1.0-abs(n.y))*(.22+.78*stain);
        float damp = mix(.56,1.0,smoothstep(-.10,.66,vP.y));
        c *= (.58 + diffuse*.83) * damp * (1.0-fault*.43-seam*.26);
      } else if (uMaterial == 3) {
        c *= texture(uBark, vec2(vUV.x*1.5, vP.y*.65)).rgb*(.58 + diffuse*.46);
      } else if (uMaterial == 4) {
        vec4 leaf = texture(uLeaves,vUV);
        if (leaf.a < .45) discard;
        vec3 tones = mix(vec3(.68,.80,.76),vec3(1.03,1.00,.86),vUV.y);
        c *= leaf.rgb*tones*(.50 + .28*abs(dot(n,light)) + .26*vUV.y);
      } else if (uMaterial == 5) {
        c *= .60 + .17*vUV.y + .34*abs(dot(n,light));
      } else if (uMaterial == 14) {
        float fibers = noise(vP.xz*vec2(44.0,96.0));
        c *= (.75+diffuse*.22)*(.83+fibers*.23);
      } else if (uMaterial == 13) {
        vec3 grain = texture(uBark,vec2(vP.x*2.7,vP.z*.59)).rgb;
        c *= (.53+grain*.86)*(.61+.42*diffuse);
      } else if (uMaterial == 6) {
        float rim = pow(1.0-abs(dot(n,toward)),3.0);
        float line = pow(max(0.0,sin(vLocal.x*48.0+vLocal.z*9.0)),20.0);
        c = mix(c, vec3(.76,.91,.97), rim*.85 + .04);
        opacity *= .26 + rim*.67 + line*.10;
      } else if (uMaterial == 9) {
        float rib = smoothstep(.27,.37,fract((vLocal.z + uBelt)/.0136));
        float grain = noise(vLocal.xz*1490.0)*.025;
        c *= ambient + diffuse*.19;
        c += (rib*.027 + grain)*max(.19,n.y);
      } else if (uMaterial == 10 || uMaterial == 16) {
        float weave = dot(texture(uFabric,vUV).rgb,vec3(.299,.587,.114));
        float under = dot(n,toward)<0.0 ? .69 : 1.0;
        float crease = .88+.22*noise(vLocal.xz*17.0+vLocal.y*19.0);
        c *= (.52+weave*.75)*(.59+diffuse*.47+.17*max(0.0,n.y))*under*crease;
        c += vec3(.067,.065,.058)*pow(1.0-abs(dot(n,toward)),3.0);
      } else if (uMaterial == 11) {
        float film = dot(texture(uVinyl,vUV).rgb,vec3(.299,.587,.114));
        float halfAngle = max(0.0,dot(n,normalize(light+toward)));
        float shine = pow(halfAngle,58.0);
        float edge = pow(1.0-max(0.0,dot(n,toward)),4.0);
        c *= (.57+film*.52)*(.62+.52*diffuse);
        c += vec3(.93,.96,.98)*(shine*.39+pow(halfAngle,14.0)*.047+edge*.087);
      } else if (uMaterial == 12) {
        vec3 scuffs = texture(uPlastic,vUV).rgb;
        float shine = pow(max(0.0,dot(n,normalize(light+toward))),36.0);
        float edge = pow(1.0-max(0.0,dot(n,toward)),3.8);
        float grain = noise(vLocal.xz*453.0+vLocal.y*317.0);
        float wear = smoothstep(.60,.84,noise(vLocal.xz*vec2(198.0,77.0)+vLocal.y*68.0));
        c *= (.50+scuffs*.72)*(.64+.41*diffuse+.11*max(0.0,n.y))*(.94+grain*.10);
        c += vec3(.90,.93,.86)*(shine*.24+edge*.059+wear*.024);
      } else if (uMaterial == 7) {
        vec2 skinUV = vec2(.50+.48*cos(vUV.x*6.283185),vUV.y*1.13);
        vec3 skin = texture(uSkin,skinUV).rgb;
        vec3 tone = clamp(skin/vec3(.765,.556,.431),vec3(.73),vec3(1.26));
        float flush = noise(vLocal.xz*51.0+vLocal.y*27.0);
        float pores = noise(vLocal.xz*956.0+vLocal.y*234.0);
        float wrapped = clamp((dot(n,light)+.34)/1.34,0.0,1.0);
        float shade = .52+.48*wrapped+.13*max(0.0,n.y);
        float sheen = pow(max(0.0,dot(n,normalize(light+toward))),38.0);
        float vein = smoothstep(.68,.94,noise(vLocal.xz*vec2(87.0,14.0)+vLocal.y*29.0));
        float rim = pow(1.0-max(0.0,dot(n,toward)),2.8);
        c *= mix(vec3(1),tone,.93)*shade*(.93+pores*.126);
        c += vec3(.087,.029,.020)*(flush-.43)+vec3(.126,.102,.084)*sheen;
        c += vec3(.072,.025,.013)*rim*(.34+.66*wrapped);
        c = mix(c,c*vec3(.91,.99,.99),vein*.46);
      } else if (uMaterial == 15) {
        float gloss = pow(max(0.0,dot(n,normalize(light+toward))),51.0);
        c *= .69+.36*diffuse;
        c += vec3(.20,.16,.15)*gloss;
      } else if (uMaterial == 17 || uMaterial == 18) {
        bool brick = uMaterial == 18;
        vec2 uv = brick ? vec2(abs(n.x)>abs(n.z) ? vP.z : vP.x,vP.y)*vec2(4.5,13.8) : vUV*vec2(7.1,9.4);
        float row = floor(uv.y);
        uv.x += mod(row,2.0)*.5;
        vec2 cell = floor(uv), edge = .5-abs(fract(uv)-.5);
        vec2 aa = max(vec2(.012),fwidth(uv));
        float joint = 1.0-smoothstep(.027,.048+max(aa.x,aa.y)*.60,min(edge.x,edge.y));
        float worn = noise(vP.xz*1.23+vP.y*.71)*.13 + noise(vP.xz*51.0+vP.y*38.0)*.08;
        float shade = .76+.18*hash(cell)+worn;
        vec3 block = brick ? c*shade*vec3(1.045,.91,.80) : c*shade*mix(vec3(.92,.88,.81),vec3(1.04,1.02,.94),hash(cell+.45));
        vec3 mortar = brick ? vec3(.48,.444,.397) : vec3(.42,.40,.354);
        c = mix(block,mortar,joint*(1.0-smoothstep(.32,1.0,max(aa.x,aa.y)))*.72);
        c *= ambient+diffuse*.29;
      } else if (uMaterial == 19 || uMaterial == 22) {
        bool asphalt = uMaterial == 22;
        vec2 q = abs(n.y)>.60 ? vP.xz : vec2(abs(n.x)>abs(n.z) ? vP.z : vP.x,vP.y);
        vec3 aggregate = texture(uSand,q*(asphalt ? 1.91 : .69)).rgb;
        float spots = noise(q*3.5)*.16+noise(q*19.6)*.18;
        float moisture = noise(q*.35+vec2(.17,-.22))*.16;
        c *= (.65+aggregate*.32+spots-moisture)*(ambient+diffuse*.34)*(asphalt ? .86 : 1.03);
      } else if (uMaterial == 25) {
        vec2 q = abs(n.y)>.6 ? vP.xz : vec2(abs(n.x)>abs(n.z) ? vP.z : vP.x,vP.y);
        float grain = noise(q*81.0)*.065 + noise(q*2.7)*.048;
        c *= (.91+grain)*(.87+.20*diffuse);
      } else if (uMaterial == 39 || uMaterial == 40 || uMaterial == 41 || uMaterial == 45) {
        vec3 face = dot(n,toward)<0.0 ? -n : n;
        vec3 reflected = reflect(-toward,face);
        float horizon = noise(reflected.xz*3.1+vP.xz*.018)*.19+.025;
        float sky = smoothstep(horizon-.08,horizon+.10,reflected.y);
        float leaves = noise(reflected.xz*8.0+reflected.y*3.4)*.63+noise(reflected.xz*31.0)*.37;
        vec3 grove = mix(vec3(.115,.139,.116),vec3(.355,.414,.303),leaves);
        vec3 daylight = mix(grove,mix(vec3(.62,.68,.69),vec3(.83,.86,.85),smoothstep(.1,.71,reflected.y)),sky);
        daylight = mix(vec3(.23,.21,.18),daylight,smoothstep(-.55,-.065,reflected.y));
        float facing = max(dot(face,toward),0.0);
        float fresnel = pow(1.0-facing,3.8);
        float gloss = pow(max(0.0,dot(face,normalize(light+toward))),56.0);
        if(uMaterial == 39) {
          float flake = noise(vLocal.xz*153.0+vLocal.y*93.0)*.04;
          c *= (.92+flake)*(ambient+diffuse*.24);
          c = mix(c,daylight,.065+.36*fresnel);
          c += daylight*gloss*.13;
        } else if(uMaterial == 40) {
          c *= .47+daylight*.68+diffuse*.23;
          c += daylight*(.13+.18*fresnel+gloss*.22);
        } else if(uMaterial == 41) {
          c = mix(c*.77,daylight,.42+fresnel*.50);
          opacity *= .22+.61*fresnel+.13*sky;
        } else {
          float ribs = .88+.12*smoothstep(-.55,.4,cos(vUV.x*143.0)*cos(vUV.y*88.0));
          c *= ribs*(.66+.24*diffuse);
          c = mix(c,daylight,.08+.27*fresnel);
          c += vec3(.43,.45,.41)*gloss*.28;
        }
      } else if (uMaterial == 42) {
        vec2 q = vLocal.xy*28.0+vLocal.z*vec2(14.0,21.0);
        vec2 warp = vec2(noise(q*.31),noise(q*.36+2.6));
        float burl = .5+.5*sin(q.y*1.2+noise(q*.92+warp*4.7)*9.0+warp.x*6.0);
        c *= mix(vec3(.57,.44,.41),vec3(1.23,1.10,.93),burl);
        c *= ambient+diffuse*.28;
        c += vec3(.16,.12,.09)*pow(max(0.0,dot(n,normalize(light+toward))),37.0);
      } else if (uMaterial == 43) {
        vec2 q = vLocal.xz*74.0+vLocal.y*vec2(61.0,111.0);
        float grain = noise(q)*.12+noise(q*.36)*.067;
        c *= (.92+grain)*(ambient+diffuse*.32);
        c += vec3(.092,.078,.063)*pow(max(0.0,dot(n,normalize(light+toward))),24.0);
      } else if (uMaterial == 44) {
        float tread = smoothstep(.57,.76,fract(vUV.x*62.0+abs(vUV.y-.5)*.69));
        float grit = noise(vLocal.yz*143.0+vLocal.x*93.0);
        c *= (.76+grit*.26-tread*.25)*(ambient+diffuse*.32);
        c += vec3(.025,.027,.026)*pow(1.0-abs(dot(n,toward)),3.0);
      } else if (uMaterial == 20) {
        float flute = .5+.5*cos(vUV.x*26.0);
        float seam = smoothstep(.90,1.0,fract(vUV.y*3.9));
        float age = .82+.24*noise(vP.xz*5.2+vP.y*6.1);
        float dust = noise(vP.xz*31.0+vP.y*12.0);
        c *= (.67 + flute*.34 - seam*.075 + dust*.09)*age*(ambient+diffuse*.41);
        c += vec3(.39,.43,.45)*pow(max(0.0,dot(normalize(light+toward),n)),31.0)*(.04+flute*.075);
      } else if (uMaterial == 21) {
        float t = uTime, apron = smoothstep(1.02,1.18,vUV.y);
        vec2 p = vec2(vUV.x,vUV.y);
        float channels = noise(vec2(p.x*12.0+noise(p*1.2)*.77,p.y*3.4-t*3.9));
        float streaks = noise(vec2(p.x*41.0,p.y*8.1-t*8.7));
        float bubbles = noise(vec2(p.x*8.0+p.y*6.9,p.y*31.0-t*6.9));
        float froth = smoothstep(.24,.87,channels*.55+streaks*.26+bubbles*.31);
        float foamEdge = 1.0-smoothstep(1.30,1.83,p.y+noise(p*9.0)*.27);
        c *= mix(vec3(.28,.37,.34),vec3(.90,.94,.93),froth*.88 + .06);
        c += vec3(.17,.19,.16)*(1.0-apron)*smoothstep(.74,.95,streaks);
        if(apron>.01) {
          if(foamEdge<.09 || froth<.38+(1.0-foamEdge)*.29) discard;
          c = mix(c,vec3(.83,.89,.87),foamEdge*.62);
        }
      } else if (uMaterial == 23) {
        c *= texture(uRoadLabels,vUV).rgb*(.83+diffuse*.21);
      } else if (uMaterial == 34) {
        c *= texture(uLobbyPrint,vUV).rgb*(.78+diffuse*.25);
      } else if (uMaterial == 24 || uMaterial == 32) {
        float fresnel = pow(1.0-abs(dot(n,toward)),2.8);
        float smudge = noise(vP.xz*13.0+vP.y*17.0)*.10;
        c = mix(c*vec3(.65,.74,.72),vec3(.74,.78,.78),fresnel*.64+.17+smudge);
        opacity *= uMaterial == 32 ? .57+.24*fresnel+smudge : .23+.55*fresnel+smudge;
      } else if (uMaterial == 26) {
        vec2 q=vUV*vec2(6.9,1.33);
        q.y+=hash(vec2(floor(q.x),7.1))*.93;
        vec2 d=.5-abs(fract(q)-.5);
        float grain=noise(vUV*vec2(130.0,6.2))+noise(vUV*vec2(243.0,15.4))*.46;
        float feather=clamp(max(fwidth(q.x),fwidth(q.y)),.008,.053);
        float joint=1.0-smoothstep(.004,.018+feather,min(d.x,d.y));
        float gloss=pow(max(0.0,dot(n,normalize(light+toward))),23.0);
        float sheen=pow(1.0-max(dot(n,toward),0.0),3.6);
        c *= (.87+.12*hash(floor(q))+.092*grain)*(1.0-.16*joint);
        c += vec3(.19,.16,.12)*gloss+vec3(.045,.043,.037)*sheen;
      } else if (uMaterial == 27) {
        vec2 p=vec2(abs(n.x)>abs(n.z) ? vP.z : vP.x,vP.y)*vec2(3.8,3.35);
        vec2 q=fract(p)-.5;
        q.x-=.055*sin(q.y*6.283);
        vec2 bloom=q-vec2(.022,.126);
        float r=length(bloom), theta=atan(bloom.y,bloom.x);
        float petals=1.0-smoothstep(.133,.177,r+.025*cos(theta*5.0));
        float core=1.0-smoothstep(.029,.052,r);
        float stem=(1.0-smoothstep(.006,.022,abs(q.x)))*(1.0-smoothstep(.045,.10,q.y));
        vec2 leaf=vec2(abs(q.x)-.079,q.y+.169+q.x*.79);
        float leaves=1.0-smoothstep(.72,1.0,length(leaf/vec2(.081,.038)));
        c *= (.93+noise(p*18.3)*.082)*(.91+diffuse*.17);
        c=mix(c,c*vec3(.67,.81,.62),max(stem*.36,leaves*.54));
        c=mix(c,c*vec3(.96,.67,.64),petals*.58+core*.28);
      } else if (uMaterial == 28 || uMaterial == 35 || uMaterial == 36) {
        bool floorTile=abs(n.y)>.61;
        bool bathFloor=uMaterial==35;
        bool diningFloor=uMaterial==36;
        vec2 p=bathFloor ? vUV*5.4 : diningFloor ? vUV*2.45 :
          (floorTile ? vP.xz : vec2(abs(n.x)>abs(n.z) ? vP.z : vP.x,vP.y))*(floorTile ? 6.0 : 3.3);
        vec2 cell=floor(p), q=fract(p), d=.5-abs(q-.5);
        float grout=1.0-smoothstep(.013,.034,min(d.x,d.y));
        float pattern=floorTile ? .042*cos(6.283*(q.x+q.y))*.5+.037*sin(6.283*(q.x-q.y)) : 0.0;
        if(bathFloor) pattern+=mix(-.14,.13,step(q.x,q.y)*.72+mod(cell.x+cell.y,2.0)*.28);
        if(diningFloor) pattern+=(noise(p*13.8)-.5)*.14;
        float glaze=pow(max(0.0,dot(n,normalize(light+toward))),44.0);
        c *= (.90+.065*hash(cell)+pattern+noise(p*9.6)*.073)*(.89+.18*diffuse);
        c=mix(c,bathFloor ? vec3(.71,.70,.65) : c*.67,grout*.68);
        c+=vec3(.22,.24,.25)*glaze*(1.0-grout);
      } else if (uMaterial == 29) {
        float shine=pow(max(0.0,dot(n,normalize(light+toward))),62.0);
        c *= .77+.29*diffuse+.07*max(n.y,0.0);
        c += vec3(.20,.22,.24)*shine;
      } else if (uMaterial == 30) {
        c *= 1.13;
      } else if (uMaterial == 31) {
        float streak=sin(vLocal.y*156.0-uTime*32.0)*.5+.5;
        float rim=pow(1.0-abs(dot(n,toward)),2.0);
        c=mix(c,vec3(.94,.98,1.0),.34*streak+.35*rim);
        opacity *= .39+.31*streak+.19*rim;
      } else if (uMaterial == 37 || uMaterial == 38) {
        vec2 p=vUV*2.0-1.0;
        float edge=uMaterial==38
          ? 1.0-smoothstep(.32,1.0,vUV.y+(noise(vP.xz*16.0+vP.y*8.6)-.5)*.32)
          : 1.0-smoothstep(.29,.94,length(p)+(noise(p*4.9+vP.xz*.09)-.5)*.32);
        float grit=noise(vP.xz*45.0+vP.y*41.0);
        opacity *= edge*(.74+.25*grit);
        c=mix(vec3(.017,.014,.011),vec3(.074,.057,.039),grit*.62);
        if(opacity<.012) discard;
      } else {
        float soft = uMaterial == 8 ? 1.0 : 0.0;
        vec3 h = normalize(light+toward);
        float specular = pow(max(0.0,dot(h,n)),48.0) * (.24-.18*soft);
        float sheen = pow(1.0-max(0.0,dot(n,toward)),3.5)*(.074-.050*soft);
        float detail = noise(vLocal.xz*680.0 + vLocal.y*185.0);
        c *= (.97 + detail*.07)*(ambient+diffuse*.36);
        c += vec3(.86,.94,1.0)*(specular+sheen);
      }

      c *= 1.0-fray*.56;
      if (uProp.w >= 4.0) c *= mix(vec3(.16,.14,.12),vec3(.54,.47,.40),noise(vLocal.xz*6.7+vLocal.y*4.2));
      if (uProp.x > 4.5) c *= vec3(.78,.75,.71);
      if (uHand == 0) {
        if(uMaterial!=30) for(int i=0;i<10;i++) {
          if(i>=uRoomCount) break;
          vec3 d=vP-uRoomData[i].xyz;
          vec4 b=uRoomBounds[i];
          if(abs(d.y)>b.y || abs(d.x)>b.x+b.z || abs(d.z)>b.x+b.z) continue;
          float cs=cos(b.w), sn=sin(b.w);
          vec2 at=vec2(cs*d.x-sn*d.z,sn*d.x+cs*d.z);
          if(abs(at.x)>b.x || abs(at.y)>b.z) continue;
          float glow=1.0-smoothstep(.15,1.34,length(at/max(b.xz,vec2(.12))));
          c *= mix(vec3(.53,.56,.60),vec3(1.02,1.0,.965)+.14*glow,uRoomData[i].w);
          break;
        }
        if(uBlastLight.w>.001) {
          vec3 fromFlash=uBlastLight.xyz-vP;
          float distance=length(fromFlash);
          float strength=uBlastLight.w*exp(-distance*.25)*(.33+.67*abs(dot(n,fromFlash/max(distance,.015))));
          c+=vec3(1.28,.69,.25)*strength;
        }
        float distanceToCamera = length(vP-uEye);
        float haze = (1.0-exp(-distanceToCamera*.0032))*.74;
        vec3 air = mix(vec3(.355,.415,.438),vec3(.54,.626,.677),smoothstep(17.0,134.0,vP.y));
        c = mix(c, air, haze);
        float fog = 1.0-exp(-distanceToCamera*.169);
        vec3 pool = mix(vec3(.235,.285,.180),vec3(.35,.397,.245),exp(min(vP.y,0.0)*.91));
        c = mix(c,mix(c*vec3(.59,.78,.56),pool,fog),uSubmerged);
      } else {
        c = mix(c,c*vec3(.67,.85,.64),uSubmerged*.76);
      }
      pixel = vec4(c,opacity);
    }`;

  const rippleGLSL = `
    uniform vec4 uRipples[${waterRipples.limit}];
    uniform highp int uRippleCount;
    float rippleRadius(float age, float power) {
      return ${waterRipples.origin}+age*(${waterRipples.speed}+${waterRipples.boost}*min(power,1.6));
    }
    float rippleFade(float age, float power) {
      return exp(-age*mix(1.22,.71,min(power,1.0)))*(1.0-smoothstep(2.8,${waterRipples.life},age));
    }`;

  const waterVertex = `#version 300 es
    precision highp float;
    ${meshInputs}
    uniform mat4 uVP;
    uniform float uTime;
    ${rippleGLSL}
    out vec3 vP;
    out float vBed;
    void main() {
      vP = aPosition;
      vBed = aUV.x;
      float wave = sin(vP.x*1.45 + vP.z*3.2 + uTime*1.8)*.023
                 + sin(vP.x*3.1 - vP.z*1.2 - uTime*2.2)*.010;
      for (int i=0; i<uRippleCount; i++) {
        vec4 r = uRipples[i];
        float age = uTime-r.z;
        float radius = rippleRadius(age,r.w);
        vec2 delta = vP.xz-r.xy;
        if (max(abs(delta.x),abs(delta.y)) > radius+.54) continue;
        float front = length(delta)-radius;
        float band = smoothstep(-1.65,-.76,front)*(1.0-smoothstep(.12,.54,front));
        if (band > 0.0) wave += .090*r.w*band*rippleFade(age,r.w)*sin(front*4.8);
      }
      vP.y += clamp(wave,-.23,.24);
      gl_Position = uVP * vec4(vP,1);
    }`;

  const waterFragment = `#version 300 es
    precision highp float;
    in vec3 vP;
    in float vBed;
    out vec4 pixel;
    uniform vec3 uEye;
    uniform vec2 uSize;
    uniform sampler2D uReflection;
    uniform mat4 uReflectionVP;
    uniform bool uReusedReflection;
    uniform float uTime;
    uniform float uSubmerged;
    ${rippleGLSL}
    ${hashGLSL}
    void main() {
      vec2 p = vP.xz;
      float t = uTime;
      float warp = noise(p*.56 + vec2(t*.054,-t*.04))*4.3;
      float eddies = noise(p*vec2(.78,1.01) + vec2(-t*.119,t*.14));
      float broad = sin(dot(p,vec2(1.32,2.79)) + t*1.7 + warp);
      float shortWave = sin(dot(p,vec2(-3.71,7.0)) - t*2.4 + broad*1.49 + warp*.45+eddies*1.72);
      float catspaw = sin(dot(p,vec2(7.7,10.2)) + t*3.0 + sin(p.x*4.1-p.y*3.8)*.8+eddies*2.31);
      vec2 slant = vec2(.038,.094)*broad + vec2(-.061,.054)*shortWave + vec2(.048,.042)*catspaw;
      float ring = 0.0, trough = 0.0, froth = 0.0;
      float footprint = max(length(dFdx(p)),length(dFdy(p)));
      float detail = 1.0-smoothstep(.085,.31,footprint);
      for (int i=0; i<uRippleCount; i++) {
        vec4 r = uRipples[i];
        float age = t-r.z;
        float radius = rippleRadius(age,r.w);
        float foamRadius = .30+.48*r.w+age*.58;
        vec2 delta = p-r.xy;
        if (max(abs(delta.x),abs(delta.y)) > max(radius+.39,foamRadius)) continue;
        float d = length(delta);
        float front = d-radius;
        float span = mix(.94,2.08,smoothstep(.23,1.08,r.w));
        if (front > -span && front < .39) {
          float band = smoothstep(-span,-.42*span,front)*(1.0-smoothstep(.09,.39,front));
          float pulse = band*r.w*rippleFade(age,r.w);
          float crest = cos((front+.035*broad+.022*shortWave)*17.8);
          vec2 outward = delta/max(.06,d);
          float light = clamp(.68+.24*dot(outward,vec2(-.75,-.66))+.11*shortWave,.37,1.0);
          slant += outward*pulse*(crest*.105*detail+sin(front*4.8)*.13);
          ring += pulse*(.031+detail*(.46*light*smoothstep(.26,.91,crest)+.095*smoothstep(.74,.99,crest)));
          trough += pulse*.22*detail*smoothstep(.24,.94,-crest);
        }
        if (age < .93 && d < foamRadius) {
          float bubbles = smoothstep(.36,1.09,r.w)*(1.0-smoothstep(.18,.93,age));
          froth = max(froth,bubbles*(1.0-smoothstep(foamRadius*.22,foamRadius,d)));
        }
      }
      slant = clamp(slant,vec2(-.28),vec2(.28));
      vec3 n = normalize(vec3(-slant.x,1.0,-slant.y));
      vec3 v = normalize(uEye-vP);
      if (uSubmerged>.01) {
        float window = smoothstep(.35,.86,dot(-n,v));
        float waves = smoothstep(.31,.86,shortWave*.55+catspaw*.31+broad*.22);
        float range = 1.0-exp(-length(uEye-vP)*.16);
        vec3 glow = mix(vec3(.223,.307,.198),vec3(.72,.757,.600),window*.75);
        glow += vec3(.64,.71,.54)*(waves*.17+min(.32,ring));
        glow = mix(glow,vec3(.278,.328,.205),range*.81);
        pixel = vec4(glow,.91);
        return;
      }
      float grazing = 1.0-max(0.0,dot(v,n));
      float fresnel = .045 + .88*pow(grazing,3.35);
      vec2 uv = gl_FragCoord.xy/uSize;
      if (uReusedReflection) {
        vec4 previous = uReflectionVP*vec4(vP,1.0);
        vec2 projected = previous.xy/max(.001,previous.w)*.5+.5;
        vec2 edge = min(projected,1.0-projected);
        uv = mix(uv,projected,smoothstep(.0,.045,min(edge.x,edge.y))*step(.001,previous.w));
      }
      vec2 bent = clamp(uv + slant * (.098+.067*grazing), vec2(.002), vec2(.998));
      vec3 mirrored = texture(uReflection, bent).rgb;
      float deep = max(0.0,-vBed);
      vec3 body = mix(vec3(.56,.502,.326),vec3(.223,.265,.135),smoothstep(.03,1.72,deep));
      body *= .90+.16*eddies;
      float mirroredLuma = dot(mirrored,vec3(.299,.587,.114));
      mirrored = mix(mirrored,vec3(mirroredLuma),.22)*vec3(.99,.997,.92);
      vec3 color = mix(body,mirrored,clamp(fresnel+.102,0.0,.92));
      vec3 halfLight = normalize(v+normalize(vec3(-.57,.69,-.43)));
      float glint = pow(max(0.0,dot(n,halfLight)),110.0);
      float skyBreak = pow(max(0.0,shortWave*.51+catspaw*.31+broad*.18),5.6) * pow(grazing,.51);
      float patchLight = smoothstep(.26,.81,noise(p*.43+vec2(t*.052,0)));
      float lip = exp(-abs(vBed + .015)*34.0);
      float shoreFoam = lip * smoothstep(.49,.88,noise(p*8.8+vec2(t*.43,-t*.35))) * (.52+.48*broad);
      float bubbles = 0.0;
      if (froth > .002) {
        bubbles = froth*smoothstep(.30,.75,noise(p*12.3+vec2(t*.72,-t*.53)))*(.66+.34*broad);
      }
      color *= 1.0-min(.27,trough);
      color += vec3(.93,.96,.94)*(glint*.58 + skyBreak*(.16+.45*patchLight) + min(.77,ring) + shoreFoam*.34 + bubbles*.70);
      float alpha = clamp(.10 + (1.0-exp(-deep*1.60))*.56 + fresnel*.40 + min(.60,ring)*.72 + shoreFoam*.29 + bubbles*.37, .10, .98);
      pixel = vec4(color,alpha);
    }`;

  const particleVertex = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPosition;
    layout(location=1) in vec4 aColor;
    layout(location=2) in float aSize;
    layout(location=3) in vec4 aDrop;
    uniform mat4 uVP;
    uniform vec2 uSize;
    out vec4 vColor;
    out vec2 vAxis;
    out float vStretch;
    flat out float vDrop;
    void main() {
      gl_Position = uVP * vec4(aPosition,1);
      float depth = max(.09,gl_Position.w);
      float size = aSize*uSize.y/depth;
      vDrop = aDrop.w;
      vAxis = vec2(0.0,1.0);
      vStretch = 1.0;
      gl_PointSize = clamp(size,1.0,38.0);
      if (vDrop > .5) {
        vec4 travel = uVP * vec4(aDrop.xyz*.027,0.0);
        vec2 motion = (travel.xy-gl_Position.xy*travel.w/depth)*vec2(uSize.x,-uSize.y)*(.5/depth);
        float distance = length(motion);
        if (distance > .001) vAxis = motion/distance;
        vStretch += min(2.25,distance/max(1.3,size));
        gl_PointSize = clamp(size*vStretch,1.0,47.0);
      }
      vColor = aColor;
    }`;

  const particleFragment = `#version 300 es
    precision highp float;
    in vec4 vColor;
    in vec2 vAxis;
    in float vStretch;
    flat in float vDrop;
    out vec4 pixel;
    void main() {
      vec2 p = gl_PointCoord*2.0-1.0;
      if (vDrop > .5) {
        vec2 drop = vec2(dot(p,vAxis),dot(p,vec2(-vAxis.y,vAxis.x))*vStretch);
        drop.y /= mix(.73,1.0,smoothstep(-.84,.58,drop.x));
        float edge = length(drop);
        if (edge > 1.0) discard;
        float shine = 1.0-smoothstep(.12,.67,length(drop-vec2(.31,-.22)));
        vec3 color = mix(vColor.rgb*.76,vec3(.99,1.0,.985),.20+.80*shine);
        pixel = vec4(color,vColor.a*(.60+.40*shine)*(1.0-smoothstep(.52,1.0,edge)));
        return;
      }
      float d = length(p);
      if (d > 1.0) discard;
      pixel = vec4(vColor.rgb, vColor.a*(1.0-smoothstep(.25,1.0,d)));
    }`;

  const plumeVertex = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aCenter;
    layout(location=1) in vec2 aSizeAlpha;
    layout(location=2) in vec4 aCloud;
    uniform mat4 uVP;
    uniform mat3 uAxes;
    out vec2 vCorner;
    flat out vec4 vCloud;
    flat out float vAlpha;
    void main() {
      vec2 p=vec2(float(gl_VertexID%2),float(gl_VertexID/2))*2.0-1.0;
      float stretch=aCloud.z>2.5 ? mix(1.30,1.82,aCloud.y) : 1.0;
      vec3 corner=uAxes[0]*p.x+uAxes[1]*p.y*stretch;
      gl_Position=uVP*vec4(aCenter+corner*aSizeAlpha.x,1.0);
      vCorner=p;
      vCloud=aCloud;
      vAlpha=aSizeAlpha.y;
    }`;

  const plumeFragment = `#version 300 es
    precision highp float;
    in vec2 vCorner;
    flat in vec4 vCloud;
    flat in float vAlpha;
    out vec4 pixel;
    ${hashGLSL}
    void main() {
      float seed=vCloud.x, age=vCloud.y, kind=vCloud.z;
      if(kind>2.5) {
        float y=vCorner.y*.5+.5;
        float curl=sin(y*7.3+age*7.8+seed*6.28)*.29*y;
        vec2 q=vec2(vCorner.x-curl,vCorner.y+age*.67);
        float turbulence=noise(q*vec2(3.9,4.7)+seed*19.0);
        float tongue=noise(q*vec2(7.1,8.5)-vec2(seed*15.3,age*1.9));
        float tip=.81+.16*turbulence;
        float width=mix(.83,.09,pow(y,.79))*(.64+.55*turbulence);
        float edge=abs(q.x)+(.48-tongue)*(.13+y*.21);
        float mask=(1.0-smoothstep(width*.50,width,edge))*smoothstep(.02,.20,y)*(1.0-smoothstep(tip-.15,tip,y));
        float heat=(1.0-smoothstep(width*.06,width*.74,edge))*(1.0-smoothstep(.30,.82,y));
        vec3 rim=mix(vec3(.64,.073,.012),vec3(1.23,.36,.046),turbulence);
        vec3 core=mix(vec3(1.36,.68,.082),vec3(1.55,1.33,.72),smoothstep(.35,.83,heat));
        pixel=vec4(mix(rim,core,smoothstep(.13,.72,heat)),clamp(vAlpha*mask*(.89+.20*tongue),0.0,1.0));
        return;
      }
      float cs=cos(vCloud.w),sn=sin(vCloud.w);
      vec2 p=mat2(cs,sn,-sn,cs)*vCorner;
      vec2 q=p+vec2(seed*19.0,age*.57);
      float billow=.61*noise(q*3.64)+.27*noise(q*7.73)+.12*noise(q*18.3);
      float rim=length(vCorner)+(.49-billow)*.62;
      float boundary=1.0-smoothstep(.85,1.0,max(abs(p.x),abs(p.y)));
      float alpha=vAlpha*(1.0-smoothstep(.18,.97,rim))*(.46+.54*billow)*boundary;
      vec3 c;
      if(kind<.5) {
        float core=(1.0-smoothstep(.08,1.0,rim))*mix(.46,1.1,billow);
        vec3 yellow=mix(vec3(1.34,.49,.08),vec3(1.55,1.37,.85),smoothstep(.28,.74,core-age*.37));
        c=mix(vec3(.62,.14,.035),yellow,smoothstep(.17,.65,billow+core-age*.24));
        alpha*=1.0+.47*core;
      } else {
        vec3 shadow=kind<1.5 ? vec3(.23,.24,.24) : vec3(.42,.362,.30);
        vec3 light=kind<1.5 ? vec3(.68,.685,.666) : vec3(.72,.63,.52);
        c=mix(shadow,light,clamp(billow*.81+.15*vCorner.y+.20*seed,0.0,1.0));
        if(kind<1.5) c+=vec3(.26,.08,.015)*(1.0-smoothstep(0.0,.28,age))*(1.0-billow);
      }
      pixel=vec4(c,clamp(alpha,0.0,1.0));
    }`;

  const filmFragment = `#version 300 es
    precision highp float;
    in vec2 uv;
    out vec4 pixel;
    uniform sampler2D uScene;
    uniform vec2 uSize;
    uniform float uTime;
    uniform float uBlastExposure;
    ${hashGLSL}
    void main() {
      float frame = floor(uTime*29.97);
      vec2 tape = min(uSize,vec2(650.0,436.0));
      float line = floor(uv.y*tape.y);
      float jog = (hash(vec2(floor(line*.48),frame))-.5)*.40/tape.x;
      float track = smoothstep(.999,1.0,hash(vec2(floor(line*.31),floor(frame*.15))));
      vec2 p = uv + vec2(jog+track*.0025,0);
      vec2 dx = vec2(1.0/tape.x,0), dy = vec2(0,.83/tape.y);
      vec3 middle = texture(uScene,p).rgb;
      vec3 left = texture(uScene,p-dx*1.24).rgb, right = texture(uScene,p+dx*1.24).rgb;
      vec3 vertical = (texture(uScene,p+dy).rgb+texture(uScene,p-dy).rgb)*.5;
      vec3 signal = middle*.61+(left+right)*.147+vertical*.096;
      vec3 colors = signal*.44+texture(uScene,p-dx*2.7+dy*.28).rgb*.32
        +texture(uScene,p+dx*2.05).rgb*.24;
      const vec3 weights = vec3(.299,.587,.114);
      float luma = dot(signal,weights);
      float contrast = mix(luma,smoothstep(.050,.914,luma),.37);
      vec3 c = vec3(contrast)+(colors-dot(colors,weights))*.86;
      c.r += (right.r-left.r)*.073;
      c.b -= (right.b-left.b)*.077;
      c *= vec3(1.015,1.009,.998);
      float fine = hash(vec2(floor(uv.x*tape.x),line)+vec2(frame*7.17,frame*.37))-.5;
      float chroma = hash(vec2(floor(uv.x*tape.x*.44),floor(line*.5))+frame*.63)-.5;
      float raster = (mod(line+mod(frame,2.0),2.0)-.5)*.007;
      float vignette = 1.0-.102*pow(length((uv-.5)*vec2(1.20,1.09)),1.7);
      c += fine*mix(.026,.012,luma)+chroma*vec3(.008,-.004,.010)+raster;
      c=mix(c,vec3(1.0,.928,.79),uBlastExposure*.73);
      pixel = vec4(clamp(c*vignette,0.0,1.0),1);
    }`;

  function program(gl, vertex, fragment) {
    const link = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(link, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(link);
    if (!gl.getProgramParameter(link, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(link));
    const uniforms = {};
    for (let i = 0; i < gl.getProgramParameter(link, gl.ACTIVE_UNIFORMS); i++) {
      const { name } = gl.getActiveUniform(link, i);
      uniforms[name.replace("[0]", "")] = gl.getUniformLocation(link, name);
    }
    return { link, uniforms };
  }

  const loadImage = source => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the valley textures."));
    image.src = source;
  });

  class Renderer {
    constructor(canvas) {
      const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
      if (!gl) throw new Error("WebGL 2 is unavailable.");
      this.gl = gl;
      this.canvas = canvas;
      this.programs = {
        sky: program(gl, screenVertex, skyFragment),
        mesh: program(gl, meshVertex(), meshFragment()),
        canopy: program(gl, meshVertex(true), meshFragment(true)),
        water: program(gl, waterVertex, waterFragment),
        particles: program(gl, particleVertex, particleFragment),
        plume: program(gl, plumeVertex, plumeFragment),
        film: program(gl, screenVertex, filmFragment)
      };
      this.fullscreen = gl.createVertexArray();
      this.particleVAO = gl.createVertexArray();
      this.particleBuffer = gl.createBuffer();
      gl.bindVertexArray(this.particleVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
      for (const [index, size, offset] of [[0,3,0],[1,4,3],[2,1,7],[3,4,8]]) {
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, size, gl.FLOAT, false, 48, offset*4);
      }
      this.plumeVAO=gl.createVertexArray();
      this.plumeBuffer=gl.createBuffer();
      gl.bindVertexArray(this.plumeVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.plumeBuffer);
      for(const [index,size,offset] of [[0,3,0],[1,2,3],[2,4,5]]) {
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index,size,gl.FLOAT,false,36,offset*4);
        gl.vertexAttribDivisor(index,1);
      }
      this.flip = new Float32Array(identity);
      this.flip[5] = -1;
      this.quality = 1;
      this.cullPlanes=new Float32Array(24);
      this.visibleWater=[];
      this.visibleCanopy=[];
      this.tileRipples=new Float32Array(waterRipples.limit*4);
      this.rippleReach=new Float32Array(waterRipples.limit);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    use(name) {
      const { gl } = this;
      const p = this.programs[name];
      gl.useProgram(p.link);
      return p.uniforms;
    }

    mesh(builder, material = 0, color = whiteMesh, damageUV = null, skin = null) {
      const { gl } = this;
      const vertexCount=builder.vertices.length/11;
      if(skin && (skin.count<1 || skin.count>maxSkinJoints ||
        skin.joints.length!==vertexCount*4 || skin.weights.length!==vertexCount*4)) {
        throw new Error("Invalid skinned vertex data or joint count.");
      }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.vertices), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(builder.indices), gl.STATIC_DRAW);
      for (const [index, size, offset] of [[0,3,0],[1,3,3],[2,2,6],[3,3,8]]) {
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, size, gl.FLOAT, false, 44, offset*4);
      }
      if(damageUV) {
        gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER,damageUV,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5,2,gl.FLOAT,false,0,0);
      }
      if(skin) {
        gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER,new Uint16Array(skin.joints),gl.STATIC_DRAW);
        gl.enableVertexAttribArray(6);
        gl.vertexAttribIPointer(6,4,gl.UNSIGNED_SHORT,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(skin.weights),gl.STATIC_DRAW);
        gl.enableVertexAttribArray(7);
        gl.vertexAttribPointer(7,4,gl.FLOAT,false,0,0);
      }
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<builder.vertices.length;i+=11) for(let axis=0;axis<3;axis++) {
        min[axis]=Math.min(min[axis],builder.vertices[i+axis]);
        max[axis]=Math.max(max[axis],builder.vertices[i+axis]);
      }
      const center=min.map((value,axis)=>(value+max[axis])*.5);
      const radius=Math.hypot(...max.map((value,axis)=>(value-min[axis])*.5));
      const margin=material===5 ? .26 : material===4 ? .09 : 0;
      const bounds=builder.vertices.length ? {min:min.map(value=>value-margin),max:max.map(value=>value+margin)} : null;
      return {vao,count:builder.indices.length,material,color,bounds,joints:skin?.count??0,
        sphere:bounds ? {center,radius:radius+margin} : null};
    }

    texture(image, repeat) {
      const { gl } = this;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE);
      const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      return tex;
    }

    async loadTextures(sources) {
      const [atlas, leaf, surfaces] = await Promise.all([
        loadImage(sources.materials),loadImage(sources.foliage),loadImage(sources.camcorder)
      ]);
      const tile = document.createElement("canvas");
      const context = tile.getContext("2d");
      tile.width = tile.height = 512;
      const tiles = image => [[0,0],[1,0],[0,1],[1,1]].map(([x,y]) => {
        const half = Math.floor(image.width/2);
        context.drawImage(image,x*half+3,y*half+3,half-6,half-6,0,0,512,512);
        return this.texture(tile, true);
      });
      this.textures = tiles(atlas);
      this.surfaceTextures = tiles(surfaces);
      tile.width = 1024; tile.height = 512;
      context.drawImage(leaf, 0, 0, tile.width, tile.height);
      this.textures.push(this.texture(tile, false));
    }

    target(w, h, old) {
      const { gl } = this;
      if (old) {
        gl.deleteTexture(old.texture);
        gl.deleteRenderbuffer(old.depth);
        gl.deleteFramebuffer(old.framebuffer);
      }
      const framebuffer = gl.createFramebuffer(), texture = gl.createTexture(), depth = gl.createRenderbuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Unable to create the game framebuffer.");
      return { framebuffer, texture, depth, w, h };
    }

    resize() {
      const { canvas } = this;
      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 600;
      const scale = Math.min(1, 1008/w, 672/h) * this.quality;
      const cw = Math.max(2, Math.round(w*scale)), ch = Math.max(2, Math.round(h*scale));
      if (!this.surface || canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw; canvas.height = ch;
        this.surface = this.target(cw, ch, this.surface);
        this.reflection = this.target(Math.max(2, Math.round(cw*.48)), Math.max(2, Math.round(ch*.48)), this.reflection);
      }
      return cw / ch;
    }

    bindTexture(unit, tex) {
      const { gl } = this;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    }

    clothMask(mask) {
      const {gl}=this, first=!mask.texture;
      if(first) mask.texture=gl.createTexture();
      this.bindTexture(11,mask.texture);
      if(!first && !mask.dirty) return;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      if(first) {
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,mask.width,mask.height,0,gl.RED,gl.UNSIGNED_BYTE,mask.pixels);
      } else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,mask.width,mask.height,gl.RED,gl.UNSIGNED_BYTE,mask.pixels);
      mask.dirty=false;
    }

    sky(target, camera, time, reflected, submerged = 0) {
      const { gl } = this;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.w, target.h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const u = this.use("sky");
      gl.uniformMatrix3fv(u.uAxes, false, camera.axes);
      gl.uniform2fv(u.uFrustum, camera.frustum);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uMirror, reflected ? -1 : 1);
      gl.uniform1f(u.uSubmerged, submerged);
      gl.bindVertexArray(this.fullscreen);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);
    }

    meshViewUniforms(u) {
      const { gl } = this;
      const {vp,at,time,reflected,submerged,roomLights}=this.meshView;
      gl.uniformMatrix4fv(u.uVP, false, vp);
      gl.uniform3fv(u.uEye, at);
      gl.uniform1f(u.uTime, time);
      gl.uniform1i(u.uReflect, +reflected);
      gl.uniform4fv(u.uBlastLight,this.blastLight);
      gl.uniform1f(u.uSubmerged, submerged);
      gl.uniform1i(u.uRoomCount,roomLights?.count??0);
      if(roomLights?.count) {
        gl.uniform4fv(u.uRoomData,roomLights.data);
        gl.uniform4fv(u.uRoomBounds,roomLights.bounds);
      }
    }

    beginMeshes(vp, at, time, reflected = false, held = false, submerged = 0, roomLights = null) {
      const { gl } = this;
      this.heldPass=held;
      this.meshView={vp,at,time,reflected,submerged,roomLights};
      if(!held) setFrustum(this.cullPlanes,vp);
      this.bindMeshView(this.use("mesh"),held);
    }

    bindMeshView(u,held=false) {
      const {gl}=this;
      this.meshViewUniforms(u);
      gl.uniform1i(u.uHand, +held);
      for (const [i, name] of [[0,"uSand"],[1,"uStone"],[3,"uBark"],[4,"uLeaves"]]) {
        this.bindTexture(i, this.textures[i]);
        gl.uniform1i(u[name], i);
      }
      for (const [i,name] of ["uFabric","uVinyl","uSkin","uPlastic"].entries()) {
        this.bindTexture(7+i,this.surfaceTextures[i]);
        gl.uniform1i(u[name],7+i);
      }
      this.bindTexture(11,this.surfaceTextures[0]);
      gl.uniform1i(u.uClothMask,11);
      this.bindTexture(12,this.roadLabels || this.textures[0]);
      gl.uniform1i(u.uRoadLabels,12);
      this.bindTexture(13,this.securityFeed?.texture || this.textures[0]);
      gl.uniform1i(u.uCctv,13);
      this.bindTexture(14,this.lobbyPrint || this.textures[0]);
      gl.uniform1i(u.uLobbyPrint,14);
    }

    draw(mesh, matrix = identity, belt = 0, effect = null, u = this.programs.mesh.uniforms) {
      if(!this.heldPass && matrix!==identity && mesh.sphere && !effect?.sleeve && !mesh.joints) {
        const {center,radius}=mesh.sphere;
        const x=matrix[12]+matrix[0]*center[0]+matrix[4]*center[1]+matrix[8]*center[2];
        const y=matrix[13]+matrix[1]*center[0]+matrix[5]*center[1]+matrix[9]*center[2];
        const z=matrix[14]+matrix[2]*center[0]+matrix[6]*center[1]+matrix[10]*center[2];
        const scale=Math.max(Math.hypot(matrix[0],matrix[1],matrix[2]),Math.hypot(matrix[4],matrix[5],matrix[6]),
          Math.hypot(matrix[8],matrix[9],matrix[10]));
        const extent=(radius+(effect?.kind ? .96 : 0))*scale, planes=this.cullPlanes;
        for(let i=0;i<planes.length;i+=4) {
          if(planes[i]*x+planes[i+1]*y+planes[i+2]*z+planes[i+3]<-extent) return;
        }
      }
      const { gl } = this;
      gl.uniformMatrix4fv(u.uModel, false, matrix);
      gl.uniform1i(u.uMaterial, mesh.material);
      if(mesh.material===33) gl.uniform1i(u.uCctvChannel,this.securityFeed?.monitor===effect?.monitor ? this.securityFeed?.channel??0 : 0);
      if(effect?.sleeve) {
        gl.uniform3fv(u.uSleeve,effect.sleeve);
        gl.uniform1i(u.uArmIK,Number(effect.ik??false));
      }
      const state=effect?.state;
      const mask=state?.mask;
      const flags=(mask ? 2 : Number(Boolean(state)))+(effect?.charred ? 4 : 0);
      gl.uniform4f(u.uProp,effect?.kind??0,effect?.phase??0,effect?.air??1,flags);
      if(effect?.tube) gl.uniform4fv(u.uTubeShape,effect.tube);
      if(state) {
        gl.uniform4fv(u.uDentAnchors,state.anchors);
        gl.uniform4fv(u.uDentPressure,state.pressure);
        if(mask) this.clothMask(mask);
        else gl.uniform4fv(u.uHoles,state.holes);
      }
      if (mesh.material === 9) gl.uniform1f(u.uBelt,belt);
      gl.uniform4fv(u.uColor, mesh.color);
      gl.bindVertexArray(mesh.vao);
      const deformation=effect?.deformation;
      if(deformation) {
        deformation.buffer??=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,deformation.buffer);
        if(deformation.dirty) {
          gl.bufferData(gl.ARRAY_BUFFER,deformation.offsets,gl.DYNAMIC_DRAW);
          deformation.dirty=false;
        }
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4,3,gl.FLOAT,false,0,0);
      }
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
      if(deformation) gl.disableVertexAttribArray(4);
    }

    drawCharacters(parts) {
      if(!parts?.length) return;
      const {gl}=this;
      let skinned=false, lastPalette;
      for(const {mesh,matrix,effect,palette} of parts) {
        if(!mesh.joints) {
          if(skinned) this.use("mesh");
          skinned=false;
          this.draw(mesh,matrix,0,effect);
          continue;
        }
        if(palette?.length!==mesh.joints*16) throw new Error("The joint palette does not match the mesh.");
        if(!this.programs.skinned) {
          const shader=this.programs.skinned=program(gl,meshVertex(false,true),meshFragment());
          this.skinBuffer=gl.createBuffer();
          gl.bindBuffer(gl.UNIFORM_BUFFER,this.skinBuffer);
          gl.bufferData(gl.UNIFORM_BUFFER,maxSkinJoints*64,gl.DYNAMIC_DRAW);
          gl.uniformBlockBinding(shader.link,gl.getUniformBlockIndex(shader.link,"JointPalette"),0);
        }
        if(!skinned) {
          this.bindMeshView(this.use("skinned"),this.heldPass);
          gl.bindBufferBase(gl.UNIFORM_BUFFER,0,this.skinBuffer);
          skinned=true;
        }
        if(palette!==lastPalette) {
          gl.bindBuffer(gl.UNIFORM_BUFFER,this.skinBuffer);
          gl.bufferSubData(gl.UNIFORM_BUFFER,0,palette);
          lastPalette=palette;
        }
        this.draw(mesh,matrix,0,effect,this.programs.skinned.uniforms);
      }
      if(skinned) this.use("mesh");
    }

    drawLandscape(meshes) {
      const {gl,visibleCanopy}=this;
      const base=this.programs.mesh.uniforms;
      gl.uniformMatrix4fv(base.uModel,false,identity);
      gl.uniform4f(base.uProp,0,0,1,0);
      visibleCanopy.length=0;
      let lastMaterial, lastColor;
      for(const mesh of meshes) {
        if(!visibleBounds(mesh.bounds,this.cullPlanes)) continue;
        if(mesh.material===4 && mesh.color===whiteMesh) {
          visibleCanopy.push(mesh);
          continue;
        }
        if(mesh.material!==lastMaterial) {
          lastMaterial=mesh.material;
          gl.uniform1i(base.uMaterial,lastMaterial);
          if(lastMaterial===9) gl.uniform1f(base.uBelt,0);
          if(lastMaterial===33) gl.uniform1i(base.uCctvChannel,0);
        }
        if(mesh.color!==lastColor) {
          lastColor=mesh.color;
          gl.uniform4fv(base.uColor,lastColor);
        }
        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);
      }
      if(!visibleCanopy.length) return;
      const u=this.use("canopy");
      this.meshViewUniforms(u);
      gl.uniform1i(u.uLeaves,4);
      for(const mesh of visibleCanopy) {
        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);
      }
      this.use("mesh");
    }

    drawWater(camera,time,submerged,ripples) {
      const {gl,reflection,surface,visibleWater,tileRipples,rippleReach}=this;
      if(!visibleWater.length) return;
      const u=this.use("water");
      this.bindTexture(5,reflection.texture);
      gl.uniform1i(u.uReflection,5);
      gl.uniform1i(u.uReusedReflection,+Boolean(reflection.reused));
      if(reflection.reused) gl.uniformMatrix4fv(u.uReflectionVP,false,reflection.view.vp);
      gl.uniform1f(u.uTime,time);
      gl.uniformMatrix4fv(u.uVP,false,camera.vp);
      gl.uniform3fv(u.uEye,camera.at);
      gl.uniform1f(u.uSubmerged,submerged);
      gl.uniform2f(u.uSize,surface.w,surface.h);
      for(let i=0;i<ripples.length;i+=4) {
        const age=time-ripples[i+2], strength=ripples[i+3];
        const ring=waterRipples.origin+age*(waterRipples.speed+waterRipples.boost*Math.min(strength,1.6));
        rippleReach[i/4]=Math.max(ring+.54,.30+.48*strength+age*.58)+.002;
      }
      for(const mesh of visibleWater) {
        const {min,max}=mesh.bounds;
        let length=0;
        for(let i=0;i<ripples.length;i+=4) {
          const x=ripples[i], z=ripples[i+1], reach=rippleReach[i/4];
          const dx=Math.max(0,min[0]-x,x-max[0]), dz=Math.max(0,min[2]-z,z-max[2]);
          if(dx*dx+dz*dz>reach*reach) continue;
          tileRipples[length++]=x;
          tileRipples[length++]=z;
          tileRipples[length++]=ripples[i+2];
          tileRipples[length++]=ripples[i+3];
        }
        gl.uniform1i(u.uRippleCount,length/4);
        if(length) gl.uniform4fv(u.uRipples,tileRipples,0,length);
        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);
      }
    }

    updateSecurity(view,time,world,props,objects) {
      const {gl}=this, scene=world.road.interior;
      let monitor=null, nearest=9;
      for(const tv of scene.monitors) {
        if(tv.picked || tv.powerLost) continue;
        const screen=point(tv.matrix,[0,.245,.235]), ray=minus(screen,view.at);
        const range=Math.hypot(...ray);
        if(range>=nearest || dot(view.forward,ray)<range*.36 || dot(direction(tv.matrix,[0,0,1]),ray)>=0) continue;
        monitor=tv;
        nearest=range;
      }
      this.securityFeed=null;
      if(!monitor) return;
      const channel=Math.floor(time/7)%monitor.cameras.length+1;
      const feed=monitor.cameras[channel-1];
      if(this.security?.monitor===monitor && this.security.channel===channel && time-this.security.at<.135) {
        this.securityFeed=this.security;
        return;
      }

      this.bindTexture(13,null);
      const target=this.security??=this.target(240,180);
      this.sky(target,feed,time,false);
      const fittings=Valley.lodging.objects(scene,feed.at,time);
      this.beginMeshes(feed.vp,feed.at,time,false,false,0,Valley.lodging.lights(scene,feed.at));
      this.drawLandscape(world.solid);
      for(const {mesh,matrix,effect} of props) if(mesh.material!==33) this.draw(mesh,matrix,0,effect);
      for(const {mesh,matrix,effect} of fittings.opaque) this.draw(mesh,matrix,0,effect);
      for(const {mesh,matrix,belt} of objects) this.draw(mesh,matrix,belt);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      this.drawLandscape(world.road.glass);
      for(const {mesh,matrix} of fittings.glass) this.draw(mesh,matrix);
      gl.depthMask(true);
      Object.assign(target,{monitor,channel,at:time});
      this.securityFeed=target;
    }

    drawReflection(camera,time,world,props,interior,roomLights) {
      const {reflection}=this, previous=reflection.view;
      // At lower quality reuse at most one frame, projected from the last water view.
      if(this.quality<=.78 && previous && !reflection.reused && time-reflection.time<.068
        && dot(previous.forward,camera.forward)>.9997 && Math.hypot(...minus(previous.at,camera.at))<.22) {
        reflection.reused=true;
        return;
      }
      reflection.reused=false;
      reflection.view=camera;
      reflection.time=time;
      this.sky(reflection, camera, time, true);
      const mirrorVP=multiply(camera.vp,this.flip);
      this.beginMeshes(mirrorVP, [camera.at[0],-camera.at[1],camera.at[2]], time, true, false, 0, roomLights);
      this.drawLandscape(world.solid);
      for (const {mesh,matrix,effect} of props) this.draw(mesh,matrix,0,effect);
      for (const {mesh,matrix,effect} of interior.opaque) this.draw(mesh,matrix,0,effect);
    }

    frame(camera, time, world, objects, held, particles, ripples, glass, blast, interaction, characters) {
      const {gl,reflection,surface,visibleWater}=this;
      this.blastLight=blast.light;
      const props = Valley.props.objects(world,camera.at);
      this.updateSecurity(camera,time,world,props,objects);
      const interior = Valley.lodging.objects(world.road.interior,camera.at,time);
      const roomLights = Valley.lodging.lights(world.road.interior,camera.at);
      const submerged = smooth(.008,.17,Valley.world.waterLevel(camera.at[0],camera.at[2])-camera.at[1]);
      setFrustum(this.cullPlanes,camera.vp);
      visibleWater.length=0;
      for(const mesh of world.water) {
        if(visibleBounds(mesh.bounds,this.cullPlanes)) visibleWater.push(mesh);
      }
      if (visibleWater.length && submerged<=.01) {
        this.drawReflection(camera,time,world,props,interior,roomLights);
      } else {
        reflection.view=null;
        reflection.reused=false;
      }

      this.sky(surface, camera, time, false, submerged);
      this.beginMeshes(camera.vp, camera.at, time, false, false, submerged, roomLights);
      this.drawLandscape(world.solid);
      for (const {mesh,matrix,effect} of props) this.draw(mesh,matrix,0,effect);
      for (const {mesh,matrix,effect} of interior.opaque) this.draw(mesh,matrix,0,effect);
      for (const { mesh, matrix, belt } of objects) this.draw(mesh,matrix,belt);
      this.drawCharacters(characters);
      // Interaction meshes share the world's depth buffer all the way to the grip point.
      if(interaction?.length) {
        for(const {mesh,matrix,effect} of interaction) this.draw(mesh,matrix,0,effect);
      }

      gl.enable(gl.BLEND);
      gl.depthMask(false);
      this.drawLandscape(world.road.glass);
      for (const {mesh,matrix} of interior.glass) this.draw(mesh,matrix);
      for (const { mesh, matrix } of glass) this.draw(mesh,matrix);
      this.drawWater(camera,time,submerged,ripples);

      if(blast.data.length) {
        const p=this.use("plume");
        gl.uniformMatrix4fv(p.uVP,false,camera.vp);
        gl.uniformMatrix3fv(p.uAxes,false,camera.axes);
        gl.bindVertexArray(this.plumeVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.plumeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,blast.data,gl.DYNAMIC_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,blast.data.length/9);
      }

      if (particles.length) {
        const p = this.use("particles");
        gl.uniformMatrix4fv(p.uVP,false,camera.vp);
        gl.uniform2f(p.uSize,surface.w,surface.h);
        gl.bindVertexArray(this.particleVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,particles,gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.POINTS,0,particles.length/12);
      }

      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.beginMeshes(camera.projection, [0,0,0], time, false, true, submerged);
      for (const { mesh, matrix, belt, effect } of held.opaque) this.draw(mesh,matrix,belt,effect);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      if (held.glass) this.draw(held.glass.mesh,held.glass.matrix);
      gl.depthMask(true);

      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.viewport(0,0,surface.w,surface.h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      const f = this.use("film");
      this.bindTexture(6,surface.texture);
      gl.uniform1i(f.uScene,6);
      gl.uniform2f(f.uSize,surface.w,surface.h);
      gl.uniform1f(f.uTime,time);
      gl.uniform1f(f.uBlastExposure,blast.exposure);
      gl.bindVertexArray(this.fullscreen);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
  }

  return { clamp, mix, smooth, plus, minus, times, dot, cross, unit, rgb, random, multiply, transform, direction, point, camera, Builder, Renderer, waterRipples, cutoutLayout, maxSkinJoints };
})();
