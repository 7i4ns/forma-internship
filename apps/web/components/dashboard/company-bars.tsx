'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip as ChartTooltip, type ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, Checkbox, Chip, LinearProgress, MenuItem, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { api, ApiError } from '../../lib/api';
import { compactNumber } from '../../lib/dashboard';
import { dimensionLabels, emptyBarFilters, makeBarRequest, type BarFilters, type CompanyBarData, type Dimension } from '../../lib/company-bars';
import { useSession } from '../providers';
ChartJS.register(BarElement, CategoryScale, LinearScale, ChartTooltip);
const groupLabel = (value:string|null) => value === null ? '未填写' : value;
export default function CompanyBars({refreshKey}:{refreshKey:number}) {
  const [dimension,setDimension] = useState<Dimension>('level');
  const [fields,setFields] = useState<BarFilters>(emptyBarFilters);
  const [loaded,setLoaded] = useState<{key:string;data:CompanyBarData}|null>(null);
  const [options,setOptions] = useState<CompanyBarData['options']>({level:[],country:[],city:[]});
  const [busy,setBusy] = useState(true); const [error,setError] = useState('');
  const [revision,setRevision] = useState(0); const [page,setPage] = useState(0);
  const router = useRouter(); const {setUser} = useSession();
  const request = useMemo(()=>makeBarRequest(dimension,fields),[dimension,fields]);
  const invalid = Object.keys(request.errors).length > 0;
  const key = request.body;
  // Associate every result with its filters. Never display a late response under
  // newer controls, even while the next request is being debounced.
  const data = loaded?.key === key && !invalid ? loaded.data : null;
  useEffect(()=>{setPage(0);},[key]);
  useEffect(()=>{
    if (invalid) {setBusy(false);return;}
    let alive = true; let inFlight = false; let controller:AbortController|null = null;
    setBusy(true); setError('');
    async function load() {
      if (inFlight || !alive) return; inFlight = true; setBusy(true); controller = new AbortController();
      try {
        const result = await api<CompanyBarData>('/dashboard/getCompaniesByFilter',{method:'POST',body:key,signal:controller.signal});
        if (alive) {setLoaded({key,data:result});setOptions(result.options);setError('');}
      } catch (error) {
        if (!alive) return;
        if (error instanceof ApiError && error.status === 401) {setUser(null);router.replace('/login');}
        else setError(error instanceof Error ? error.message : '查询失败，请重试');
      } finally {inFlight = false;if(alive)setBusy(false);}
    }
    const timeout = setTimeout(()=>void load(),400);
    const interval = setInterval(()=>{if(!document.hidden)void load();},30000);
    const focus = ()=>void load(); window.addEventListener('focus',focus);
    return ()=>{alive=false;controller?.abort();clearTimeout(timeout);clearInterval(interval);window.removeEventListener('focus',focus);};
  },[key,invalid,revision,refreshKey,router,setUser]);
  const activeCount = fields.level.length+fields.country.length+fields.city.length+(['start','end','revenueMin','revenueMax','employeesMin','employeesMax'] as const).filter(k=>fields[k].trim()).length;
  const pageCount = data ? Math.ceil(data.groups.length/20) : 0;
  const safePage = Math.min(page,Math.max(0,pageCount-1));
  const rows = data?.groups.slice(safePage*20,safePage*20+20) || [];
  const chart = useRef<ChartJS<'bar'>|null>(null);
  const chartOptions: ChartOptions<'bar'> = {
    responsive:true,maintainAspectRatio:false,animation:{duration:250},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>groupLabel(rows[items[0]?.dataIndex]?.value??null),label:item=>{const row=rows[item.dataIndex];return `${row.count.toLocaleString('zh-CN')} 家 · 占筛选结果 ${row.percentage.toFixed(2)}%`;}}}},
    scales:{x:{title:{display:true,text:dimensionLabels[dimension]},grid:{display:false},ticks:{autoSkip:false,maxRotation:45,minRotation:0,callback:function(value){const label=this.getLabelForValue(Number(value));return label.length>16?label.slice(0,15)+'…':label;}}},y:{beginAtZero:true,title:{display:true,text:'公司数量（家）'},ticks:{precision:0,callback:value=>{const result=compactNumber(Number(value));return result.text+result.unit;}}}},
  };
  const highlight = (index:number|null)=>{
    const instance=chart.current;if(!instance)return;
    const elements=index===null?[]:[{datasetIndex:0,index}];instance.setActiveElements(elements);
    const center=index===null?{x:0,y:0}:(instance.getDatasetMeta(0).data[index] as BarElement | undefined)?.getCenterPoint(false)||{x:0,y:0};
    instance.tooltip?.setActiveElements(elements,center);instance.update('none');
  };
  return <Paper component="section" variant="outlined" aria-labelledby="company-bars-title" sx={{p:{xs:2,md:3},borderRadius:3,minWidth:0}}>
    <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" spacing={2} sx={{mb:3}}><Box><Typography fontSize={10} color="text.secondary" letterSpacing={2} sx={{mb:1}}>COMPANY EXPLORER</Typography><Typography id="company-bars-title" component="h2" variant="h6">公司分布分析</Typography><Typography fontSize={12} color="text.secondary" sx={{mt:1}}>切换维度并组合筛选，比较供应链中的公司数量。</Typography></Box><Stack direction="row" spacing={1} alignItems="center"><Button variant="text" size="small" disabled={!activeCount} onClick={()=>{setFields(emptyBarFilters());setPage(0);}}>清空筛选</Button><Button variant="outlined" size="small" disabled={busy||invalid} onClick={()=>setRevision(n=>n+1)}>刷新图表</Button></Stack></Stack>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr',lg:'repeat(4,minmax(0,1fr))'},gap:2}}>
      <TextField select size="small" label="横轴维度" value={dimension} onChange={e=>setDimension(e.target.value as Dimension)}>{(Object.keys(dimensionLabels) as Dimension[]).map(k=><MenuItem key={k} value={k}>{dimensionLabels[k]}</MenuItem>)}</TextField>
      {(['level','country','city'] as const).map(k=><Autocomplete key={k} multiple disableCloseOnSelect options={options[k]} value={fields[k]} limitTags={1} onChange={(_,value)=>setFields(previous=>({...previous,[k]:value}))} size="small" noOptionsText="暂无可选项" renderOption={(props,option,{selected})=>{const {key,...rest}=props;return <li key={key} {...rest}><Checkbox size="small" checked={selected} sx={{mr:1}} />{option}</li>;}} renderInput={params=><TextField {...params} label={`${dimensionLabels[k]}筛选`} placeholder={fields[k].length?'':'全部'} />} />)}
    </Box>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(3,minmax(0,1fr))'},gap:2,mt:2}}>
      {([
        ['加入供应链年份','start','end','开始年份','结束年份','按 founded_year 字段筛选'],
        ['年收入','revenueMin','revenueMax','最低年收入','最高年收入','原始金额单位，最多2位小数'],
        ['员工数量','employeesMin','employeesMax','最少员工','最多员工','非负整数，单位：人'],
      ] as const).map(([title,lo,hi,loLabel,hiLabel,caption])=><Box key={lo} sx={{p:1.5,bgcolor:'#f7f9f7',borderRadius:2}}><Typography fontSize={12} fontWeight={600} sx={{mb:1.5}}>{title}</Typography><Stack direction="row" spacing={1} alignItems="start">{([lo,hi] as const).map((field,index)=><TextField key={field} fullWidth size="small" label={index?hiLabel:loLabel} value={fields[field]} placeholder="不限" error={!!request.errors[field]} helperText={request.errors[field]} onChange={e=>setFields(previous=>({...previous,[field]:e.target.value}))} inputProps={{inputMode:lo==='revenueMin'?'decimal':'numeric',maxLength:21}} />)}</Stack><Typography fontSize={10} color="text.secondary" sx={{mt:1}}>{caption} · 含起止值</Typography></Box>)}
    </Box>
    <Typography fontSize={11} color="text.secondary" sx={{my:2}}>同项多选取并集，不同条件同时满足；留空表示不限。筛选仅影响本区域。</Typography>
    {invalid && <Alert severity="warning">请修正标红的范围值，图表将在输入有效后自动更新。</Alert>}
    {!invalid && error && <Alert severity="error" action={<Button onClick={()=>setRevision(n=>n+1)} disabled={busy}>重试</Button>}>{data?'更新失败，以下仍是上次成功查询的结果。':''}{error}</Alert>}
    {busy && !invalid && <LinearProgress sx={{my:1}} />}
    {!invalid&&!data&&!error&&<Skeleton variant="rounded" height={360} />}
    {data&&<><Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" spacing={1} sx={{mt:2,mb:2}}><Stack direction="row" spacing={1} alignItems="center"><Typography variant="subtitle2">按{dimensionLabels[dimension]}统计</Typography><Chip size="small" label={`${data.total.toLocaleString('zh-CN')} 家公司`} sx={{bgcolor:'#e9f2eb',color:'#376b52'}} /><Typography fontSize={11} color="text.secondary">{data.groups.length} 个分组</Typography></Stack><Typography fontSize={10} color="text.secondary" aria-live="polite">{busy?'正在更新…':`最近更新 ${new Date(data.generatedAt).toLocaleTimeString('zh-CN',{hour12:false})}`}</Typography></Stack>
      {data.total===0?<Alert severity="info">没有符合当前条件的公司，请调整或清空筛选。</Alert>:<>
        <Box sx={{overflowX:'auto'}} onMouseLeave={()=>highlight(null)}><Box sx={{height:360,minWidth:Math.max(480,rows.length*78)}}><Bar ref={chart} aria-label={`按${dimensionLabels[dimension]}分组的公司数量，筛选结果共${data.total}家；详细数值见下方数据表`} role="img" options={chartOptions} data={{labels:rows.map(r=>groupLabel(r.value)),datasets:[{label:'公司数量',data:rows.map(r=>r.count),backgroundColor:'#6e9c7e',hoverBackgroundColor:'#376b52',borderRadius:5,maxBarThickness:56}]}} /></Box></Box>
        {data.groups.length>20&&<TablePagination component="div" count={data.groups.length} page={safePage} rowsPerPage={20} rowsPerPageOptions={[20]} onPageChange={(_,value)=>setPage(value)} labelRowsPerPage="每页分组" labelDisplayedRows={({from,to,count})=>`第 ${from}–${to} 组 / 共 ${count} 组`} getItemAriaLabel={type=>type==='next'?'下一页分组':'上一页分组'} />}
        <Accordion elevation={0} disableGutters sx={{mt:2,border:'1px solid',borderColor:'divider',borderRadius:'12px !important','&:before':{display:'none'}}}><AccordionSummary expandIcon={<span>⌄</span>}><Typography fontSize={12}>查看分组数据表{data.groups.length>20?'（与图表同步分页）':''}</Typography></AccordionSummary><AccordionDetails sx={{pt:0}}><TableContainer><Table size="small" aria-label="公司分布分组数据"><TableHead><TableRow><TableCell>{dimensionLabels[dimension]}</TableCell><TableCell align="right">公司数量</TableCell><TableCell align="right">占筛选结果</TableCell></TableRow></TableHead><TableBody>{rows.map((row,index)=><TableRow key={row.value===null?'null':`value:${row.value}`} hover tabIndex={0} onMouseEnter={()=>highlight(index)} onMouseLeave={()=>highlight(null)} onFocus={()=>highlight(index)} onBlur={()=>highlight(null)}><TableCell>{groupLabel(row.value)}{row.value===null?'（空值）':''}</TableCell><TableCell align="right">{row.count.toLocaleString('zh-CN')}</TableCell><TableCell align="right">{row.percentage.toFixed(2)}%</TableCell></TableRow>)}</TableBody></Table></TableContainer></AccordionDetails></Accordion>
      </>}
      <Typography fontSize={10} color="text.secondary" sx={{mt:2}}>按公司数量降序排列 · 每30秒自动更新 · 年份使用 founded_year；启用范围时，该字段缺失的公司不计入结果。</Typography>
    </>}
  </Paper>;
}
