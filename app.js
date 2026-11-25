(() => {
  'use strict';
  const ROOT_ID = '1V6f7enRcBWD9I4lKPbxdYl82Yfh6y1km';
  const PAGE_SIZE = 32;
  const $ = (s) => document.querySelector(s);
  const els = {
    list: $('#documentList'), search: $('#searchInput'), stage: $('#stageFilter'), cls: $('#classFilter'), type: $('#typeFilter'), sort: $('#sortFilter'),
    count: $('#resultsCount'), loadMore: $('#loadMore'), empty: $('#emptyState'), error: $('#loadError'), nav: $('#stageNav'),
    dialog: $('#readerDialog'), frame: $('#readerFrame'), readerTitle: $('#readerTitle'), readerPath: $('#readerPath'), readerLoading: $('#readerLoading'),
    drive: $('#openInDrive'), clear: $('#clearFilters'), emptyClear: $('#emptyClear')
  };
  let files = [];
  let folders = {};
  let visibleCount = PAGE_SIZE;
  let filtered = [];
  let activeStage = '';
  let stageOptions = [];
  const arabicCompare = new Intl.Collator('ar', {numeric: true, sensitivity: 'base'});
  const norm = (s) => String(s || '').normalize('NFKC').toLocaleLowerCase('ar').replace(/[إأآٱ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/\s+/g, ' ').trim();
  const extOf = (name) => ((String(name).match(/\.([^.\s]+)$/) || [,''])[1] || '').toLowerCase();
  const isPdf = (file) => extOf(file.name) === 'pdf';
  const driveFileUrl = (file) => file.url || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`;
  const previewUrl = (file) => `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/preview`;
  const segments = (path) => String(path || '').split(' / ').filter(Boolean).filter((x) => x !== 'المكتبة');
  const firstSegment = (path) => segments(path)[0] || 'ملفات متنوعة';
  const secondSegment = (path) => segments(path)[1] || '';
  const leafSegment = (path) => segments(path).at(-1) || '';
  const isStageName = (name) => ['المرحلة الابتدائية','المرحلة المتوسطة','المرحلة الثانوية','القرآن الكريم كاملاً'].includes(name);
  const iconLabel = (file) => isPdf(file) ? 'PDF' : (extOf(file).slice(0, 5).toUpperCase() || 'FILE');

  function setOption(select, value, label) {
    const opt = document.createElement('option'); opt.value = value; opt.textContent = label; select.append(opt);
  }
  function buildStageNav(stageOptions) {
    els.nav.replaceChildren();
    const makeButton = (stage, title, glyph, count) => {
      const b=document.createElement('button'); b.type='button'; b.className=`stage-button${activeStage === stage ? ' active' : ''}`; b.dataset.stage=stage;
      const leading=document.createElement('span'); leading.className='stage-leading';
      const symbol=document.createElement('span'); symbol.className='stage-glyph'; symbol.textContent=glyph;
      const label=document.createElement('span'); label.textContent=title; leading.append(symbol,label);
      const number=document.createElement('span'); number.className='stage-count'; number.textContent=count.toLocaleString('ar');
      b.append(leading,number); return b;
    };
    els.nav.append(makeButton('', 'كل الملفات', '⌂', files.length));
    stageOptions.forEach((stage) => {
      const count = files.filter(f => firstSegment(f.path) === stage).length;
      const glyph = stage.includes('ابتدائية') ? '١' : stage.includes('متوسطة') ? '٢' : stage.includes('ثانوية') ? '٣' : '✦';
      const title = stage === 'القرآن الكريم كاملاً' ? 'القرآن الكريم' : stage;
      els.nav.append(makeButton(stage, title, glyph, count));
    });
  }
  function updateClassOptions() {
    const previous=els.cls.value; els.cls.replaceChildren(); setOption(els.cls,'','كل الصفوف');
    const subset=files.filter(f => !els.stage.value || firstSegment(f.path)===els.stage.value);
    const classes=[...new Set(subset.map(f=>secondSegment(f.path)).filter(Boolean))].sort(arabicCompare.compare);
    classes.forEach(x=>setOption(els.cls,x,x));
    if(classes.includes(previous)) els.cls.value=previous;
  }
  function refresh() {
    const q=norm(els.search.value), stage=els.stage.value, cls=els.cls.value, type=els.type.value;
    filtered=files.filter(f=>{
      const hay=norm(`${f.name} ${f.path} ${f.type || ''}`);
      if(q && !hay.includes(q)) return false;
      if(stage && firstSegment(f.path)!==stage) return false;
      if(cls && secondSegment(f.path)!==cls) return false;
      if(type==='pdf' && !isPdf(f)) return false;
      if(type==='other' && isPdf(f)) return false;
      return true;
    });
    filtered.sort((a,b)=>els.sort.value==='path' ? arabicCompare.compare(`${a.path} ${a.name}`,`${b.path} ${b.name}`) : arabicCompare.compare(a.name,b.name));
    visibleCount=PAGE_SIZE; render();
  }
  function makeCard(file, index) {
    const card=document.createElement('article'); card.className='document-card'; card.style.animationDelay=`${Math.min(index*18,180)}ms`;
    const icon=document.createElement('div'); icon.className=`doc-icon${isPdf(file)?'':' other'}`; icon.textContent=iconLabel(file); icon.setAttribute('aria-hidden','true');
    const info=document.createElement('div'); info.className='doc-info';
    const title=document.createElement('h3'); title.className='doc-title'; title.textContent=file.name;
    const path=document.createElement('div'); path.className='doc-path'; path.textContent=file.path || 'مجلد المكتبة'; path.title=path.textContent;
    const tags=document.createElement('div'); tags.className='doc-tags';
    const t1=document.createElement('span'); t1.className='doc-tag'; t1.textContent=firstSegment(file.path); tags.append(t1);
    const subsection=secondSegment(file.path); if(subsection){const t=document.createElement('span');t.className='doc-tag';t.textContent=subsection;tags.append(t)}
    const typeTag=document.createElement('span');typeTag.className=`doc-tag${isPdf(file)?' pdf':''}`;typeTag.textContent=isPdf(file)?'PDF':(extOf(file)||'ملف').toUpperCase();tags.append(typeTag);
    info.append(title,path,tags);
    const actions=document.createElement('div');actions.className='doc-actions';
    const read=document.createElement('button');read.type='button';read.className='read-button';read.textContent='اقرأ الآن';read.setAttribute('aria-label',`افتح ${file.name} في القارئ الداخلي`);read.addEventListener('click',()=>openReader(file));
    const external=document.createElement('a');external.className='external-button';external.href=driveFileUrl(file);external.target='_blank';external.rel='noopener noreferrer';external.title='فتح الملف في Google Drive';external.setAttribute('aria-label',`فتح ${file.name} في Google Drive`);external.textContent='↗';
    actions.append(read,external);card.append(icon,info,actions);return card;
  }
  function render() {
    els.count.textContent=`${filtered.length.toLocaleString('ar')} ملف`;
    els.list.replaceChildren();
    const batch=filtered.slice(0,visibleCount);
    batch.forEach((f,i)=>els.list.append(makeCard(f,i)));
    els.empty.hidden=filtered.length!==0;
    els.list.hidden=filtered.length===0;
    els.loadMore.hidden=visibleCount>=filtered.length;
    if(filtered.length===0 && activeStage==='القرآن الكريم كاملاً'){
      $('#emptyState h3').textContent='لم تُدرج ملفات في هذا المجلد';
      $('#emptyState p').textContent='ظهر مجلد «القرآن الكريم كاملاً» في Drive، لكنه لا يعرض ملفات متاحة في الفهرس الحالي.';
    } else {
      $('#emptyState h3').textContent='لم نعثر على ملفات مطابقة';
      $('#emptyState p').textContent='جرّب كلمة أخرى أو أزل بعض عوامل التصفية.';
    }
  }
  function openReader(file) {
    const fileUrl=driveFileUrl(file);
    els.readerTitle.textContent=file.name;
    els.readerPath.textContent=file.path || 'مجلد المكتبة';
    els.drive.href=fileUrl;
    els.readerLoading.classList.remove('done');
    els.frame.src=previewUrl(file);
    els.frame.onload=()=>setTimeout(()=>els.readerLoading.classList.add('done'),500);
    els.frame.onerror=()=>els.readerLoading.classList.add('done');
    if(typeof els.dialog.showModal==='function') els.dialog.showModal(); else window.open(fileUrl,'_blank','noopener');
  }
  function closeReader() { if(els.dialog.open) els.dialog.close(); els.frame.src='about:blank'; }
  function clearFilters(){els.search.value='';els.stage.value='';els.cls.value='';els.type.value='';activeStage='';buildStageNav(stageOptions);updateClassOptions();refresh()}

  async function init(){
    $('#year').textContent=String(new Date().getFullYear());
    try{
      const response=await fetch('catalog.json',{cache:'no-cache'}); if(!response.ok) throw new Error('catalog response '+response.status);
      const catalog=await response.json();
      files=(catalog.files||[]).map(f=>({...f,url:f.url||`https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`}));
      folders=catalog.folders||{};
      $('#statFiles').textContent=files.length.toLocaleString('ar');
      $('#statFolders').textContent=Object.keys(folders).length.toLocaleString('ar');
      stageOptions=Object.values(folders).filter(f=>f.parentId===ROOT_ID).map(f=>f.name).filter(isStageName);
      if (files.some(f => !f.path)) stageOptions.push('ملفات متنوعة');
      stageOptions.sort(arabicCompare.compare);
      buildStageNav(stageOptions);
      stageOptions.forEach(x=>setOption(els.stage,x,x.replace('المرحلة ','مرحلة ')));
      updateClassOptions();refresh();
    }catch(error){console.error(error);els.error.hidden=false;els.count.textContent='الفهرس غير متاح';}
  }
  els.search.addEventListener('input',refresh);
  els.nav.addEventListener('click', (event) => {
    const b=event.target.closest('button[data-stage]'); if(!b) return;
    activeStage=b.dataset.stage; els.stage.value=activeStage; updateClassOptions(); refresh();
    els.nav.querySelectorAll('.stage-button').forEach(x=>x.classList.toggle('active',x===b));
    if (window.matchMedia('(max-width:680px)').matches) $('#library').scrollIntoView({behavior:'smooth',block:'start'});
  });
  els.stage.addEventListener('change',()=>{activeStage=els.stage.value;updateClassOptions();buildStageNav(stageOptions);refresh()});
  els.cls.addEventListener('change',refresh);els.type.addEventListener('change',refresh);els.sort.addEventListener('change',refresh);
  els.clear.addEventListener('click',clearFilters);els.emptyClear.addEventListener('click',clearFilters);
  els.loadMore.addEventListener('click',()=>{visibleCount+=PAGE_SIZE;render()});
  $('#closeReader').addEventListener('click',closeReader);
  els.dialog.addEventListener('click',(event)=>{if(event.target===els.dialog)closeReader()});
  els.dialog.addEventListener('close',()=>{els.frame.src='about:blank'});
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&els.dialog.open)closeReader()});
  init();
})();
