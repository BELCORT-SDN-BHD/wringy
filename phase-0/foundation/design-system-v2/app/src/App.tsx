import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowUpRightIcon, AlertTriangleIcon, CircleXIcon, ClockIcon, InfoIcon, CircleCheckIcon, MinusIcon, CheckIcon, ChevronsUpDownIcon, ComponentIcon, FileCodeIcon, SearchIcon } from 'lucide-react'
import { CoreExample, coreStates, stateLabels, type ButtonVariant } from './gallery-core'
import { AdvancedExample } from './gallery-advanced'
import { productCopy, type ProductLocale } from './lib/product-copy'
import registry from '../public/registry-manifest.json'
import palette from '../provenance/palette.json'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const entries=registry.entries
const sources=import.meta.glob('./components/ui/*.tsx',{query:'?raw',import:'default',eager:true}) as Record<string,string>
const categories=[...new Set(entries.map(e=>e.category))]
function selectedFromHash(){let id='';try{id=decodeURIComponent(location.hash.slice(1))}catch{return 'button'};return entries.some(e=>e.id===id)?id:'button'}

// Local color bindings only: official components and variants remain untouched.
const allocation = [
 { role: 'attention', icon: AlertTriangleIcon },
 { role: 'info', icon: ClockIcon },
 { role: 'error', icon: CircleXIcon },
 { role: 'success', icon: CircleCheckIcon },
 { role: 'inactive', icon: MinusIcon },
 { role: 'inactive', icon: InfoIcon },
] as const
function badgeColors(role: string): CSSProperties {
 return { '--secondary': `var(--${role}-subtle)`, '--secondary-foreground': `var(--${role}-foreground)` } as CSSProperties
}
function ColorAllocation(){
 const [locale,setLocale]=useState<ProductLocale>('en-MY')
 const copy=productCopy[locale]
 const rows=allocation.map((role,index)=>({...role,...copy.rows[index]}))
 return <Card id="color-allocation" className="min-w-0"><CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle>颜色分工 · 演示</CardTitle><Badge variant="secondary" data-color-role="brand" style={{'--secondary':'var(--brand)','--secondary-foreground':'var(--brand-foreground)'} as CSSProperties}><ComponentIcon data-icon="inline-start"/>Wringy 品牌</Badge></div><CardDescription>颜色表示紧急程度与行动要求，不代表完整业务状态。品牌黄不用于悬停、选中或警告。</CardDescription></CardHeader><CardContent className="flex min-w-0 flex-col gap-4">
 <Field><FieldLabel htmlFor="product-language">Product language / Bahasa produk / 产品语言</FieldLabel><Select value={locale} onValueChange={value=>setLocale(value as ProductLocale)}><SelectTrigger id="product-language"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="en-MY">English</SelectItem><SelectItem value="ms-MY">Bahasa Melayu</SelectItem><SelectItem value="zh-Hans-MY">简体中文</SelectItem></SelectGroup></SelectContent></Select><FieldDescription>仅切换演示文案；英语为临时可用性默认，并非平台默认语言决定。马来语和中文均为待专业审校草稿；中文暂按马来西亚简体中文（zh-Hans-MY）处理。未来平台首次使用时会询问偏好语言，并可在设置中更改；此流程尚未实现。</FieldDescription></Field>
 <Alert lang={locale} data-color-role="attention" style={{'--card':'var(--attention-subtle)','--card-foreground':'var(--attention-foreground)','--muted-foreground':'var(--attention-foreground)'} as CSSProperties}><AlertTriangleIcon/><AlertTitle>{copy.alertTitle}</AlertTitle><AlertDescription>{copy.alertDescription}</AlertDescription></Alert>
 <ItemGroup lang={locale}>{rows.map(({role,label,detail,icon:Icon})=><Item key={label} role="listitem"><ItemMedia variant="icon" data-color-icon={role} style={{color:`var(--${role}-foreground)`}}><Icon/></ItemMedia><ItemContent><ItemTitle>{label}</ItemTitle><ItemDescription>{detail}</ItemDescription></ItemContent></Item>)}</ItemGroup>
 <Table lang={locale} aria-label="颜色分工演示"><TableHeader><TableRow><TableHead>{copy.status}</TableHead><TableHead>{copy.nextStep}</TableHead></TableRow></TableHeader><TableBody>{rows.map(({role,label,next,icon:Icon})=><TableRow key={label}><TableCell><Badge variant="secondary" data-color-role={role} style={badgeColors(role)}><Icon data-icon="inline-start"/>{label}</Badge></TableCell><TableCell>{next}</TableCell></TableRow>)}</TableBody></Table>
 </CardContent><CardFooter><FieldDescription>全部为本地演示。未知数据保持中性或信息色；只有已确认的即时阻塞才升级提醒。</FieldDescription></CardFooter></Card>
}

function Workspace(){
 const [selected,setSelected]=useState(selectedFromHash),[query,setQuery]=useState(''),[state,setState]=useState('live'),[variant,setVariant]=useState<ButtonVariant>('default'),[tab,setTab]=useState('preview')
 const {setOpenMobile,isMobile}=useSidebar()
 const entry=entries.find(e=>e.id===selected)!, states=coreStates[selected]||['live']
 const visible=entries.filter(e=>`${e.id} ${e.name} ${e.category}`.toLowerCase().includes(query.toLowerCase()))
 const choose=(id:string)=>{location.hash=id;setSelected(id);setState(coreStates[id]?.[0]||'live');setVariant('default');setTab('preview');if(isMobile)setOpenMobile(false)}
 useEffect(()=>{const change=()=>{const id=selectedFromHash();setSelected(id);setState(coreStates[id]?.[0]||'live');setTab('preview')};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[])
 return <>
 <Sidebar><SidebarHeader><SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg" asChild><a href="#button"><ComponentIcon/><div className="flex flex-1 flex-col"><span>Wringy</span><span className="text-xs text-muted-foreground">Design System</span></div><ChevronsUpDownIcon/></a></SidebarMenuButton></SidebarMenuItem></SidebarMenu><InputGroup><InputGroupInput aria-label="搜索组件" placeholder="搜索组件…" value={query} onChange={e=>setQuery(e.target.value)}/><InputGroupAddon><SearchIcon/></InputGroupAddon></InputGroup></SidebarHeader><SidebarContent>{categories.map(category=>{const group=visible.filter(e=>e.category===category);return group.length?<SidebarGroup key={category}><SidebarGroupLabel>{category}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{group.map(e=><SidebarMenuItem key={e.id}><SidebarMenuButton isActive={e.id===selected} onClick={()=>choose(e.id)} data-component={e.id} aria-current={e.id===selected?'page':undefined}><span>{e.name}</span><span className="ml-auto text-xs text-muted-foreground">{e.kind==='pattern'?'指南':''}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>:null})}{!visible.length&&<Empty><EmptyHeader><EmptyTitle>没有匹配组件</EmptyTitle><EmptyDescription>试试中文名称或英文 ID。</EmptyDescription></EmptyHeader><Button variant="outline" onClick={()=>setQuery('')}>清除搜索</Button></Empty>}</SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={()=>{setTab('source');if(isMobile)setOpenMobile(false)}}><FileCodeIcon/><span>官方源码与配色</span><Badge variant="outline">v2</Badge></SidebarMenuButton></SidebarMenuItem></SidebarMenu><p className="px-2 text-xs text-muted-foreground">61 个官方文件 · 3 个指南模式</p></SidebarFooter></Sidebar>
 <SidebarInset className="min-w-0"><header className="flex min-w-0 items-center gap-3 border-b px-4 py-3"><SidebarTrigger aria-label="打开或关闭组件目录"/><Separator orientation="vertical" className="h-4"/><Breadcrumb><BreadcrumbList><BreadcrumbItem className="hidden sm:block">设计系统</BreadcrumbItem><BreadcrumbSeparator className="hidden sm:block"/><BreadcrumbItem><BreadcrumbPage>{entry.name}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><Badge variant="outline" className="ml-auto">Radix · Nova</Badge></header>
 <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-4 md:p-6" id="main"><div className="flex flex-wrap items-end justify-between gap-4"><div className="flex min-w-0 flex-col gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{entry.category}</Badge><Badge variant="outline">{entry.kind==='native'?'官方组件':'官方组合指南'}</Badge></div><h1 className="text-2xl font-semibold tracking-tight" data-testid="component-heading">{entry.name} <span className="text-muted-foreground">/ {entry.id}</span></h1><p className="text-sm text-muted-foreground">官方结构与默认交互。Wringy 只更换颜色。</p></div><Button variant="outline" asChild><a href={entry.docs} target="_blank" rel="noreferrer">官方文档<ArrowUpRightIcon data-icon="inline-end"/></a></Button></div>
 <div className="md:hidden"><Field><FieldLabel htmlFor="component-select">选择组件</FieldLabel><Select value={selected} onValueChange={choose}><SelectTrigger id="component-select" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup>{entries.map(e=><SelectItem key={e.id} value={e.id}>{e.name} / {e.id}</SelectItem>)}</SelectGroup></SelectContent></Select></Field></div>
 <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="preview">交互示例</TabsTrigger><TabsTrigger value="contract">使用与边界</TabsTrigger><TabsTrigger value="source">源码与配色</TabsTrigger></TabsList>
 <TabsContent value="preview"><div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]"><Card className="min-w-0"><CardHeader><CardTitle>组件画布</CardTitle><CardDescription>可以直接操作；所有数据仅限当前页面。</CardDescription></CardHeader><CardContent><div className="min-w-0 py-4" id="specimen" data-component-id={selected}>{coreStates[selected]?<CoreExample key={`${selected}:${state}:${variant}`} id={selected} state={state} variant={variant}/>:<AdvancedExample key={selected} id={selected}/>}</div></CardContent><CardFooter><FieldDescription>不覆盖官方圆角、字体、间距、焦点宽度或动效。Hover / Focus 请用实际指针与键盘体验。</FieldDescription></CardFooter></Card><Card className="min-w-0"><CardHeader><CardTitle>检查器</CardTitle><CardDescription>只设置组件真正支持的属性。</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="state-select">演示状态</FieldLabel><Select value={state} onValueChange={setState}><SelectTrigger id="state-select" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup>{states.map(s=><SelectItem key={s} value={s}>{stateLabels[s]||s}</SelectItem>)}</SelectGroup></SelectContent></Select><FieldDescription>{states.length===1?'本例通过组件内的触发器、选项和操作展示行为。':'选择状态会重新创建当前示例，重置其本地输入。'}</FieldDescription></Field>{selected==='button'&&<Field><FieldLabel id="variant-label">官方变体</FieldLabel><ToggleGroup type="single" variant="outline" value={variant} onValueChange={v=>v&&setVariant(v as ButtonVariant)} orientation="vertical" aria-labelledby="variant-label">{(['default','outline','secondary','ghost','destructive','link'] as const).map(v=><ToggleGroupItem key={v} value={v}>{v}</ToggleGroupItem>)}</ToggleGroup></Field>}<Separator/><Field><FieldLabel>来源状态</FieldLabel><FieldDescription>CLI 4.21.0<br/>radix-nova<br/>{entry.kind==='native'?'原始组件源码保持不变':'按官方指南组合现有组件'}</FieldDescription></Field></FieldGroup></CardContent></Card></div></TabsContent>
 <TabsContent value="contract"><Card><CardHeader><CardTitle>使用契约</CardTitle><CardDescription>组件行为以当前源码和对应 Radix 文档为准。</CardDescription></CardHeader><CardContent><Accordion type="multiple" defaultValue={['source','scope']}><AccordionItem value="source"><AccordionTrigger>什么来自官方？</AccordionTrigger><AccordionContent>组件结构、默认变体、尺寸、字体、圆角、焦点和动效来自官方 radix-nova。颜色通过全局语义变量与局部颜色绑定替换。Linear 只影响紧凑侧栏、工具条、连续工作区和按对象组织信息的页面关系。</AccordionContent></AccordionItem><AccordionItem value="states"><AccordionTrigger>怎样检查适用状态？</AccordionTrigger><AccordionContent>用 Tab、方向键、Enter 和 Escape 体验实际行为。禁用使用 disabled，校验错误使用 Field 的 data-invalid 与控件 aria-invalid，处理中组合 Spinner。静态组件没有人为添加的 loading 或 disabled 状态。</AccordionContent></AccordionItem><AccordionItem value="scope"><AccordionTrigger>覆盖范围与未交付部分</AccordionTrigger><AccordionContent>当前目录包含 61 个实际生成的 UI 文件，以及 Data Table、Date Picker、Typography 三项官方指南模式。旧 Form 注册项没有源码，表单示例使用 Field。Toast 在当前 Radix 文档对应 Sonner。没有真实 API、账号权限、审核、付款或持久存储，也不声称覆盖每个浏览器、每个属性组合。</AccordionContent></AccordionItem></Accordion></CardContent><CardFooter><Button variant="outline" asChild><a href={entry.docs} target="_blank" rel="noreferrer">核对对应官方文档</a></Button></CardFooter></Card></TabsContent>
 <TabsContent value="source"><div className="flex min-w-0 flex-col gap-4"><ColorAllocation/><Alert><CheckIcon/><AlertTitle>保持官方源码不变</AlertTitle><AlertDescription>61 份 UI 文件有原始副本与 SHA-256 哈希。全局 CSS 仅改浅色颜色值，原始 Geist、圆角与其他声明保留。</AlertDescription></Alert><Card className="min-w-0"><CardHeader><CardTitle>{entry.source}</CardTitle><CardDescription>{entry.kind==='native'?'下方直接读取当前官方文件。':'此项由官方组件组成，详见对应指南。'}</CardDescription></CardHeader><CardContent><pre className="max-h-96 overflow-auto text-xs" tabIndex={0} aria-label="组件源码"><code>{sources[`./components/ui/${entry.id}.tsx`]||`官方指南：${entry.docs}\n本例不创建同名 UI 源文件。`}</code></pre></CardContent></Card><Card className="min-w-0"><CardHeader><CardTitle>浅色语义配色</CardTitle><CardDescription>森林色用于主要动作；浅中性灰用于工作区、悬停与选中。琥珀色提示行动、红色提示阻塞、蓝色提供信息、低饱和绿表示完成；酸柠黄仅为品牌点缀。</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>变量</TableHead><TableHead>颜色</TableHead></TableRow></TableHeader><TableBody>{Object.entries(palette.colors).map(([name,value])=><TableRow key={name}><TableCell>--{name}</TableCell><TableCell>{value}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></div></TabsContent>
 </Tabs><Separator/><footer className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Wringy · 本地设计文档 · 浅色</span><span>官方源码，不冒充完整 Linear 内部设计系统。</span></footer></div></SidebarInset><Toaster theme="light"/>
 </>
}
export default function App(){return <SidebarProvider><Workspace/></SidebarProvider>}
