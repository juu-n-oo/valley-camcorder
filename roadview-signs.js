"use strict";

(() => {
  const fonts={
    block:'"HYHeadLine-Medium", "HY헤드라인M", "Dotum", "돋움", "Gulim", "굴림", "Malgun Gothic", sans-serif',
    print:'"Dotum", "돋움", "Gulim", "굴림", "Malgun Gothic", sans-serif',
    serif:'"Gungsuh", "궁서", "Batang", "바탕", serif',
    numbers:'"Arial Narrow", "Arial", sans-serif'
  };
  const ivory="#eee8d7", steel="#aeaea1";
  const styles={
    stone:{type:"notice",base:"#e6e4d5",ink:"#292e29",border:"#677366",stripe:"#315957"},
    blue:{type:"guide",base:"#25486d",ink:"#f0eddc",border:"#ccd3c9",stripe:"#193751"},
    green:{type:"guide",base:"#305e50",ink:"#f1eedc",border:"#c6d0b5",stripe:"#24483d"},
    wood:{type:"plaque",base:"#392f27",ink:"#e8d8b4",border:"#ac9366",stripe:"#241e19"},
    heritage:{type:"heritage",base:"#3b2c25",ink:"#e3c888",border:"#9e7950",stripe:"#221914",cells:[2,1]},
    "shop-ivory":{type:"fascia",base:"#ece8d9",ink:"#a33730",border:"#a1a497",stripe:"#293e66",cells:[2,1]},
    "shop-red":{type:"fascia",base:"#9f3833",ink:"#f3eddb",border:"#d8c6a9",stripe:"#73302c",cells:[2,1]},
    "shop-green":{type:"fascia",base:"#276052",ink:"#f0ecd5",border:"#b6c0a5",stripe:"#1b4c42",cells:[2,1]},
    "shop-blue":{type:"fascia",base:"#244a7b",ink:"#f2ecd1",border:"#adbac5",stripe:"#9f3f36",cells:[2,1]},
    "blade-red":{type:"blade",base:"#a23e36",ink:"#f4ecd4",border:"#d0c5ad",stripe:"#e1bc72",cells:[1,3]},
    "blade-blue":{type:"blade",base:"#254b7b",ink:"#f3dc9c",border:"#b7bdba",stripe:"#ae4c3b",cells:[1,3]},
    "blade-ivory":{type:"blade",base:"#eee7d4",ink:"#92362e",border:"#b5aa90",stripe:"#254773",cells:[1,3]},
    warning:{type:"warning",base:"#efe7cf",ink:"#2d2b25",border:"#80755e",stripe:"#a2342d",cells:[2,1]},
    menu:{type:"menu",base:"#eee9db",ink:"#262920",border:"#777568",stripe:"#a34233",cells:[3,3]},
    plate:{type:"plate",base:"#467651",ink:"#f0edd6",border:"#c4c3a5"},
    carBadge:{type:"carBadge",base:"#a2a59b",ink:"#282e2e",border:"#acafa6"},
    carDials:{type:"carDials",base:"#242827",ink:"#c6c8bb",border:"#393c39"},
    carRadio:{type:"carRadio",base:"#87905a",ink:"#282b22",border:"#232523"},
    range:{type:"range",base:"#d3c9ad",cells:[2,1]}
  };
  const menuGroups=[
    ["식사류","#a94b39",[
      ["산채정식","6,000"],["산채비빔밥","4,500"],["된장찌개","4,000"],["김치찌개","4,000"],["라면","2,000"]
    ]],
    ["별미류","#2e507e",[
      ["도토리묵","5,000"],["감자전","4,000"],["해물파전","6,000"],["메밀전병","4,500"],["잔치국수","3,000"]
    ]],
    ["음료류","#2d786e",[
      ["막걸리","2,000"],["소주","2,000"],["맥주","3,000"],["식혜","1,500"],["음료수","1,000"]
    ]]
  ];

  function letter(g,text,x,y,width,requested,{ink,family=fonts.block,weight=700,spacing=0,stroke=0,align="center"}) {
    if(!text) return;
    const chars=Array.from(text);
    const setFont=size=>{g.font=`${weight} ${size}px ${family}`;};
    const span=size=>chars.reduce((sum,char)=>sum+g.measureText(char).width,0)+(chars.length-1)*spacing*size;
    setFont(requested);
    const size=requested*Math.min(1,width/Math.max(1,span(requested)+requested*stroke));
    setFont(size);
    const metrics=g.measureText(text);
    const baseline=y+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;
    const length=span(size);
    let cursor=align==="center" ? x-length/2 : align==="right" ? x-length : x;
    g.textAlign="left";
    g.textBaseline="alphabetic";
    g.fillStyle=g.strokeStyle=ink;
    g.lineJoin="round";
    g.lineWidth=size*stroke;
    for(const char of chars) {
      if(stroke) g.strokeText(char,cursor,baseline);
      g.fillText(char,cursor,baseline);
      cursor+=g.measureText(char).width+spacing*size;
    }
  }

  function trim(g,w,h,style) {
    const inset=Math.min(w*.065,h*.045);
    g.strokeStyle=style.border;
    g.lineWidth=Math.min(h*.015,w*.03);
    g.strokeRect(inset,inset,w-2*inset,h-2*inset);
    g.fillStyle="#ffffff2b";
    g.fillRect(inset,inset,w-2*inset,Math.min(1.25,h*.009));
    if(style.type==="plaque" || style.type==="heritage") return;
    const r=Math.min(2.2,h*.015,w*.021);
    g.fillStyle=style.type==="menu" || style.type==="notice" ? "#807963" : steel;
    for(const x of [inset+r*1.6,w-inset-r*1.6]) for(const y of [inset+r*1.6,h-inset-r*1.6]) {
      g.beginPath();
      g.arc(x,y,r,0,Math.PI*2);
      g.fill();
    }
  }

  function paintMenu(g,text,w,h,style) {
    const pad=w*.032, gap=w*.023, column=(w-2*pad-2*gap)/3;
    letter(g,text,w/2,h*.131,w*.55,h*.151,{ink:"#252923",family:fonts.print,spacing:.26,stroke:.024});
    g.fillStyle="#b2a891";
    g.fillRect(pad,h*.224,w-2*pad,h*.007);
    for(const [index,[heading,color,items]] of menuGroups.entries()) {
      const x=pad+index*(column+gap);
      g.fillStyle=color;
      g.fillRect(x,h*.261,column,h*.148);
      letter(g,heading,x+column/2,h*.337,column*.90,h*.123,{ink:ivory,spacing:.21,stroke:.018});
      for(const [row,[name,price]] of items.entries()) {
        const y=h*(.478+row*.097);
        letter(g,name,x+column*.025,y,column*.60,h*.092,
          {ink:style.ink,family:fonts.print,align:"left",stroke:.014});
        letter(g,price,x+column*.973,y,column*.365,h*.099,
          {ink:"#962f2c",family:fonts.numbers,align:"right",spacing:.009,stroke:.011});
      }
    }
  }

  function paintRange(g,w,h) {
    function panel(x,y,width,height,radius,color) {
      g.beginPath();
      g.roundRect(x*w,y*h,width*w,height*h,radius*h);
      g.fillStyle=color;
      g.fill();
    }
    panel(.009,.044,.982,.912,.14,"#272c2a");
    const lacquer=g.createLinearGradient(0,0,0,h);
    lacquer.addColorStop(0,"#ab3b26");
    lacquer.addColorStop(.58,"#b14831");
    lacquer.addColorStop(1,"#7e2d22");
    for(const [x,width] of [[.027,.320],[.351,.298],[.653,.320]]) {
      panel(x,.101,width,.764,.091,"#b9b3a0");
      panel(x+.004,.132,width-.008,.702,.072,lacquer);
    }
    g.fillStyle="#451e1866";
    for(let row=0;row<10;row++) g.fillRect(w*.361,h*(.155+row*.065),w*.278,h*.007);
    panel(.414,.323,.172,.278,.016,"#e5dfc9");
    letter(g,"Rinnai",w*.50,h*.454,w*.15,h*.174,{ink:"#322a24",family:"Georgia, serif"});
    letter(g,"AUTOMATIC IGNITION",w*.50,h*.720,w*.225,h*.073,{ink:"#ecd9b9",family:fonts.numbers});
    for(const u of [.251,.749]) {
      letter(g,"Safety Valve",w*(u+.087),h*.32,w*.119,h*.101,{ink:"#e6c9aa",family:fonts.numbers});
      letter(g,"OFF",w*u,h*.183,w*.042,h*.073,{ink:ivory,family:fonts.numbers});
      letter(g,"ON",w*(u-.063),h*.704,w*.044,h*.083,{ink:ivory,family:fonts.numbers});
      g.beginPath();
      g.ellipse(w*u,h*.53,h*.325,h*.325,0,Math.PI*.79,Math.PI*1.45);
      g.strokeStyle="#e1d0ad";
      g.lineWidth=h*.015;
      g.stroke();
    }
    const wear=Valley.random(2619);
    for(let i=0;i<230;i++) {
      const y=wear()*h;
      g.fillStyle=i%3 ? "#49352631" : "#e5d6ba63";
      g.fillRect(wear()*w,y,(.13+wear()*2.2)*(y<h*.12 || y>h*.84 ? 2 : 1),.3+wear()*1.3);
    }
  }

  function paint(g,entry) {
    const {x,y,width,height,aspect,theme,text,sub}=entry;
    const style=styles[theme], h=160,w=h*aspect;
    g.save();
    g.translate(x,y);
    g.scale(width/w,height/h);
    g.fillStyle=style.base;
    g.fillRect(0,0,w,h);
    const fade=g.createLinearGradient(0,0,w*.7,h);
    fade.addColorStop(0,"#fff2d020");
    fade.addColorStop(.53,"#fff2d007");
    fade.addColorStop(1,"#181a1a12");
    g.fillStyle=fade;
    g.fillRect(0,0,w,h);
    const {type,ink,stripe}=style;
    if(type==="range") {
      paintRange(g,w,h);
      g.restore();
      return;
    } else if(type==="plate") {
      g.strokeStyle=style.border;
      g.lineWidth=4;
      g.beginPath();
      g.roundRect(5,5,w-10,h-10,10);
      g.stroke();
      for(const u of [.13,.87]) {
        g.fillStyle="#b6b1a0";
        g.beginPath();
        g.arc(w*u,h*.235,5.2,0,Math.PI*2);
        g.fill();
      }
      letter(g,text,w/2,h*.300,w*.71,h*.324,{ink,family:fonts.print,weight:700,spacing:.047});
      letter(g,sub,w/2,h*.695,w*.87,h*.607,{ink,family:fonts.print,weight:700,spacing:.035});
      const wear=Valley.random(1843);
      for(let i=0;i<155;i++) {
        g.fillStyle=i%3 ? "#2a332737" : "#dfd4ae63";
        g.fillRect(wear()*w,wear()*h,1.1+wear()*2.4,.4+wear()*1.1);
      }
      g.restore();
      return;
    } else if(type==="carDials") {
      for(const [u,r,numbers] of [[.27,64,["0","2","4","6","8"]],[.70,64,["0","50","100","150","220"]]]) {
        const x=w*u,y=h*.58;
        g.fillStyle="#161b1c";
        g.beginPath();
        g.arc(x,y,r,0,Math.PI*2);
        g.fill();
        for(let i=0;i<=20;i++) {
          const a=(.78+i*.072)*Math.PI, large=i%5===0;
          g.strokeStyle=ink;
          g.lineWidth=large ? 2.5 : 1.1;
          g.beginPath();
          g.moveTo(x+Math.cos(a)*(r-5),y+Math.sin(a)*(r-5));
          g.lineTo(x+Math.cos(a)*(r-(large ? 16 : 10)),y+Math.sin(a)*(r-(large ? 16 : 10)));
          g.stroke();
          if(large) letter(g,numbers[i/5],x+Math.cos(a)*37,y+Math.sin(a)*36,36,15,{ink,family:fonts.numbers});
        }
        g.strokeStyle="#b34c39";
        g.lineWidth=3.8;
        g.beginPath();
        g.moveTo(x,y);
        g.lineTo(x-r*.78,y+r*.49);
        g.stroke();
      }
      letter(g,"P",w*.487,h*.44,26,23,{ink:"#84bf93",family:fonts.numbers});
      g.restore();
      return;
    } else if(type==="carBadge" || type==="carRadio") {
      letter(g,text,w/2,h*.53,w*.88,h*.68,{ink,family:fonts.numbers,spacing:type==="carBadge" ? .38 : .045});
      g.restore();
      return;
    } else if(type==="menu") {
      paintMenu(g,text,w,h,style);
    } else if(type==="blade") {
      const chars=Array.from(text.replace(/[·\s]/g,""));
      const first=h*.116, span=h*(sub ? .688 : .775), stride=span/chars.length;
      for(const [i,char] of chars.entries()) {
        letter(g,char,w/2,first+stride*(i+.5),w*.78,Math.min(w*.77,stride*.92),{ink,stroke:.048});
      }
      if(sub) {
        g.fillStyle=stripe;
        g.fillRect(w*.055,h*.829,w*.890,h*.118);
        letter(g,sub,w/2,h*.887,w*.80,h*.084,{ink:theme==="blade-red" ? "#50352a" : ivory,stroke:.035,spacing:.07});
      }
    } else if(type==="fascia") {
      g.fillStyle=stripe;
      g.fillRect(0,0,w,h*.076);
      if(sub) g.fillRect(0,h*.730,w,h*.270);
      letter(g,text,w/2,h*(sub ? .408 : .535),w*.914,h*.699,{ink,spacing:.095,stroke:.045});
      letter(g,sub,w/2,h*.851,w*.86,h*.193,{ink:ivory,family:fonts.print,spacing:.11,stroke:.019});
    } else if(type==="warning") {
      g.fillStyle=stripe;
      g.fillRect(w*.025,h*.067,w*.950,h*.475);
      letter(g,text,w/2,h*.304,w*.82,h*.395,{ink:ivory,stroke:.042,spacing:.13});
      letter(g,sub,w/2,h*.733,w*.86,h*.237,{ink,spacing:.095,stroke:.020});
      g.fillStyle="#b58137";
      g.fillRect(w*.024,h*.897,w*.952,h*.041);
    } else {
      const number=/^\d{3}$/.test(text), heritage=type==="heritage", notice=type==="notice";
      const large=notice ? .325 : heritage ? .71 : number ? .662 : .57;
      const family=heritage ? fonts.serif : number ? fonts.numbers : notice ? fonts.print : fonts.block;
      if(type==="guide" || notice) {
        g.fillStyle=stripe;
        g.fillRect(w*.029,h*.761,w*.942,h*.184);
      } else if(sub) {
        g.fillStyle=style.border;
        g.fillRect(w*.11,h*.641,w*.78,h*.009);
      }
      letter(g,text,w/2,h*(sub ? .388 : .499),w*.862,h*large,
        {ink,family,spacing:heritage ? .14 : .048,stroke:heritage ? .016 : .025});
      letter(g,sub,w/2,h*(type==="guide" || notice ? .853 : .793),w*.854,h*(notice ? .141 : .157),
        {ink:notice ? ivory : ink,family:fonts.print,spacing:.075,stroke:.009});
    }
    trim(g,w,h,style);
    g.restore();
  }

  function create() {
    const columns=8,rows=16,cellWidth=256,cellHeight=128;
    const width=columns*cellWidth,height=rows*cellHeight;
    const cells=new Uint8Array(columns*rows), entries=[],cache=new Map();
    function allocate(across,down) {
      // The wider boards fill from the top, leaving contiguous rows free for menus.
      const compact=across===1 && down===1;
      for(let i=0;i<=rows-down;i++) for(let x=0;x<=columns-across;x++) {
        const y=compact ? rows-down-i : i;
        let free=true;
        for(let v=y;v<y+down;v++) for(let u=x;u<x+across;u++) {
          if(cells[v*columns+u]) free=false;
        }
        if(!free) continue;
        for(let v=y;v<y+down;v++) cells.fill(1,v*columns+x,v*columns+x+across);
        return {x:x*cellWidth,y:y*cellHeight,width:across*cellWidth,height:down*cellHeight};
      }
      throw new Error("Map sign atlas is full");
    }

    return {
      uv(text,sub,w,h,theme) {
        const aspect=Math.round(w/h*100)/100;
        const key=JSON.stringify([text,sub,theme,aspect]);
        if(cache.has(key)) return cache.get(key);
        const slot=allocate(...(styles[theme].cells??[1,1]));
        const u0=(slot.x+3)/width,u1=(slot.x+slot.width-3)/width;
        const v0=1-(slot.y+slot.height-3)/height,v1=1-(slot.y+3)/height;
        const uv=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
        entries.push({...slot,text,sub,theme,aspect});
        cache.set(key,uv);
        return uv;
      },
      texture(renderer) {
        const canvas=document.createElement("canvas");
        canvas.width=width;
        canvas.height=height;
        const g=canvas.getContext("2d");
        for(const entry of entries) paint(g,entry);
        return renderer.texture(canvas,false);
      }
    };
  }

  Valley.roadSigns={create,fonts};
})();
