import { useId, useState, type ComponentProps } from "react"
import { zhCN } from "react-day-picker/locale"
import type { DateRange } from "react-day-picker"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  CheckIcon,
  FileTextIcon,
  FolderIcon,
  SearchIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import * as CarouselUI from "@/components/ui/carousel"
import * as ChartUI from "@/components/ui/chart"
import * as ComboboxUI from "@/components/ui/combobox"
import * as CommandUI from "@/components/ui/command"
import * as ContextUI from "@/components/ui/context-menu"
import * as DialogUI from "@/components/ui/dialog"
import * as DrawerUI from "@/components/ui/drawer"
import * as DropdownUI from "@/components/ui/dropdown-menu"
import * as HoverUI from "@/components/ui/hover-card"
import * as MenubarUI from "@/components/ui/menubar"
import * as NavigationUI from "@/components/ui/navigation-menu"
import * as PaginationUI from "@/components/ui/pagination"
import * as PopoverUI from "@/components/ui/popover"
import * as ResizableUI from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import * as SelectUI from "@/components/ui/select"
import * as SheetUI from "@/components/ui/sheet"
import * as SidebarUI from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import * as TableUI from "@/components/ui/table"
import * as TabsUI from "@/components/ui/tabs"
import * as TooltipUI from "@/components/ui/tooltip"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { DirectionProvider } from "@/components/ui/direction"
import * as AttachmentUI from "@/components/ui/attachment"
import * as BubbleUI from "@/components/ui/bubble"
import * as MarkerUI from "@/components/ui/marker"
import * as MessageUI from "@/components/ui/message"
import * as ScrollerUI from "@/components/ui/message-scroller"

// Official radix-nova sources, inspected 2026-09-11. No component appearance overrides.
// Docs: https://ui.shadcn.com/docs/components/radix/{id}
// Chat docs exist even though shadcn 4.21.0 `docs` has no links for those five IDs.
// All interactions below are local DEMO state; no requests, uploads, or messages leave this page.
const courses = ["创作课程", "摄影练习", "剪辑笔记"]
const lessons = [
  { id: "DEMO-01", title: "创作课程", state: "草稿", chapters: 3 },
  { id: "DEMO-02", title: "摄影练习", state: "待检查", chapters: 5 },
  { id: "DEMO-03", title: "剪辑笔记", state: "已整理", chapters: 2 },
  { id: "DEMO-04", title: "声音练习", state: "草稿", chapters: 4 },
]
const basicModes = [
  ["default", "默认"],
  ["disabled", "禁用"],
  ["error", "错误"],
] as const

type Option = readonly [string, string]
function SampleState({
  value,
  onChange,
  options,
  label = "样本状态",
}: {
  value: string
  onChange: (value: string) => void
  options: readonly Option[]
  label?: string
}) {
  const controlId = useId()
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
        <SelectUI.Select value={value} onValueChange={onChange}>
          <SelectUI.SelectTrigger id={controlId} className="w-full sm:w-56">
            <SelectUI.SelectValue />
          </SelectUI.SelectTrigger>
          <SelectUI.SelectContent>
            <SelectUI.SelectGroup>
              {options.map(([key, text]) => (
                <SelectUI.SelectItem key={key} value={key}>
                  {text}
                </SelectUI.SelectItem>
              ))}
            </SelectUI.SelectGroup>
          </SelectUI.SelectContent>
        </SelectUI.Select>
      </Field>
    </FieldGroup>
  )
}

function CourseTable({
  selected = "",
  onSelect,
}: {
  selected?: string
  onSelect?: (id: string) => void
}) {
  return (
    <TableUI.Table>
      <TableUI.TableCaption>演示课程目录 · 无真实客户资料</TableUI.TableCaption>
      <TableUI.TableHeader>
        <TableUI.TableRow>
          <TableUI.TableHead scope="col">课程</TableUI.TableHead>
          <TableUI.TableHead scope="col">状态</TableUI.TableHead>
          <TableUI.TableHead scope="col">章节</TableUI.TableHead>
        </TableUI.TableRow>
      </TableUI.TableHeader>
      <TableUI.TableBody>
        {lessons.map((item) => (
          <TableUI.TableRow
            key={item.id}
            data-state={selected === item.id ? "selected" : undefined}
            aria-selected={onSelect ? selected === item.id : undefined}
          >
            <TableUI.TableCell>
              {onSelect ? (
                <Button
                  variant="ghost"
                  aria-pressed={selected === item.id}
                  onClick={() => onSelect(item.id)}
                >
                  {item.title}
                </Button>
              ) : (
                item.title
              )}
            </TableUI.TableCell>
            <TableUI.TableCell>
              <Badge variant="secondary">{item.state}</Badge>
            </TableUI.TableCell>
            <TableUI.TableCell>{item.chapters}</TableUI.TableCell>
          </TableUI.TableRow>
        ))}
      </TableUI.TableBody>
    </TableUI.Table>
  )
}

function DateExample({ picker = false }: { picker?: boolean }) {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 8, 18))
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2026, 8, 18),
    to: new Date(2026, 8, 21),
  })
  const [mode, setMode] = useState("default")
  const [open, setOpen] = useState(false)
  const label = date
    ? date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "请选择日期"
  const calendar =
    mode === "range" ? (
      <Calendar
        mode="range"
        locale={zhCN}
        defaultMonth={new Date(2026, 8, 1)}
        selected={range}
        onSelect={setRange}
      />
    ) : (
      <Calendar
        mode="single"
        locale={zhCN}
        defaultMonth={new Date(2026, 8, 1)}
        selected={date}
        onSelect={(value) => {
          setDate(value)
          if (picker) setOpen(false)
        }}
        disabled={mode === "disabled" ? true : { dayOfWeek: [0, 6] }}
      />
    )
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={
          picker
            ? basicModes.slice(0, 2)
            : [
                ["default", "单日 · 周末禁用"],
                ["range", "已选日期范围"],
                ["disabled", "全部禁用"],
              ]
        }
      />
      {picker ? (
        <PopoverUI.Popover open={open} onOpenChange={setOpen}>
          <PopoverUI.PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={mode === "disabled"}
              aria-label={`选择练习日期，${label}`}
            >
              {label}
            </Button>
          </PopoverUI.PopoverTrigger>
          <PopoverUI.PopoverContent className="w-auto p-0">
            {calendar}
          </PopoverUI.PopoverContent>
        </PopoverUI.Popover>
      ) : (
        <div className="w-fit max-w-full overflow-x-auto">{calendar}</div>
      )}
      <p role="status">
        {mode === "range"
          ? `已选：${range?.from?.toLocaleDateString("zh-CN") ?? "未选"} 至 ${range?.to?.toLocaleDateString("zh-CN") ?? "待选结束日"}`
          : `已选：${label}`}
        。仅日期样例，没有创建预约。
      </p>
    </div>
  )
}

function ChoiceExample({ id }: { id: "combobox" | "command" | "select" }) {
  const [mode, setMode] = useState("default")
  const [value, setValue] = useState<string | null>(null)
  const [chosen, setChosen] = useState("尚未选择")
  const controlId = useId()
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={
          id === "command"
            ? [
                ["default", "默认"],
                ["loading", "读取中样例"],
              ]
            : [...basicModes, ["loading", "读取中样例"]]
        }
      />
      {mode === "loading" ? (
        <div role="status" className="flex flex-col gap-3">
          <Spinner aria-label="演示读取中" />
          <Skeleton className="h-8 w-full" />
          <p>读取状态样例；切回默认继续选择。</p>
        </div>
      ) : id === "command" ? (
        <CommandUI.Command aria-label="课程快速查找">
          <CommandUI.CommandInput
            placeholder="搜索课程，如摄影"
            aria-label="搜索课程"
          />
          <CommandUI.CommandList>
            <CommandUI.CommandEmpty>
              没有匹配课程，请修改关键词。
            </CommandUI.CommandEmpty>
            <CommandUI.CommandGroup heading="演示课程">
              {courses.map((course) => (
                <CommandUI.CommandItem
                  key={course}
                  value={course}
                  onSelect={() => setChosen(course)}
                >
                  {course}
                </CommandUI.CommandItem>
              ))}
              <CommandUI.CommandItem value="归档课程" disabled>
                归档课程 · 不可选
              </CommandUI.CommandItem>
            </CommandUI.CommandGroup>
          </CommandUI.CommandList>
        </CommandUI.Command>
      ) : (
        <FieldGroup>
          <Field
            data-invalid={mode === "error"}
            data-disabled={mode === "disabled"}
          >
            <FieldLabel htmlFor={controlId}>选择演示课程</FieldLabel>
            {id === "combobox" ? (
              <ComboboxUI.Combobox
                items={courses}
                value={value}
                onValueChange={setValue}
                disabled={mode === "disabled"}
              >
                <ComboboxUI.ComboboxInput
                  id={controlId}
                  placeholder="搜索并选择课程"
                  disabled={mode === "disabled"}
                  aria-invalid={mode === "error"}
                  showClear
                />
                <ComboboxUI.ComboboxContent>
                  <ComboboxUI.ComboboxEmpty>
                    没有匹配课程。
                  </ComboboxUI.ComboboxEmpty>
                  <ComboboxUI.ComboboxList>
                    {(course: string) => (
                      <ComboboxUI.ComboboxItem key={course} value={course}>
                        {course}
                      </ComboboxUI.ComboboxItem>
                    )}
                  </ComboboxUI.ComboboxList>
                </ComboboxUI.ComboboxContent>
              </ComboboxUI.Combobox>
            ) : (
              <SelectUI.Select
                value={value ?? ""}
                onValueChange={setValue}
                disabled={mode === "disabled"}
              >
                <SelectUI.SelectTrigger
                  id={controlId}
                  aria-invalid={mode === "error"}
                >
                  <SelectUI.SelectValue placeholder="请选择课程" />
                </SelectUI.SelectTrigger>
                <SelectUI.SelectContent>
                  <SelectUI.SelectGroup>
                    <SelectUI.SelectLabel>演示课程</SelectUI.SelectLabel>
                    {courses.map((course) => (
                      <SelectUI.SelectItem key={course} value={course}>
                        {course}
                      </SelectUI.SelectItem>
                    ))}
                    <SelectUI.SelectItem value="archived" disabled>
                      归档课程 · 不可选
                    </SelectUI.SelectItem>
                  </SelectUI.SelectGroup>
                </SelectUI.SelectContent>
              </SelectUI.Select>
            )}
            {mode === "error" && (
              <FieldError>
                校验错误样例：课程引用需要重新核对。切回默认后可重新选择。
              </FieldError>
            )}
            {mode === "disabled" && (
              <FieldDescription>
                当前为禁用样例，切回默认可操作。
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      )}
      <p role="status">
        当前选择：{id === "command" ? chosen : (value ?? "尚未选择")}
      </p>
    </div>
  )
}

function OverlayExample({
  id,
}: {
  id: "dialog" | "drawer" | "sheet" | "popover"
}) {
  const [mode, setMode] = useState("default")
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("课程目录")
  const [saved, setSaved] = useState("尚未应用")
  const fieldId = useId()
  const blocked = mode === "disabled" || mode === "loading"
  const invalid = mode === "error" || !draft.trim()
  const fields = (
    <FieldGroup>
      <Field data-invalid={invalid} data-disabled={blocked}>
        <FieldLabel htmlFor={fieldId}>演示视图名称</FieldLabel>
        <Input
          id={fieldId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={blocked}
          aria-invalid={invalid}
        />
        {invalid ? (
          <FieldError>请输入名称；错误样例需切回默认后再应用。</FieldError>
        ) : (
          <FieldDescription>仅修改本页样本，不保存到服务器。</FieldDescription>
        )}
      </Field>
    </FieldGroup>
  )
  const apply = (
    <Button
      disabled={blocked || invalid}
      onClick={() => {
        setSaved(draft.trim())
        setOpen(false)
      }}
    >
      {mode === "loading" && (
        <Spinner data-icon="inline-start" aria-label="模拟处理中" />
      )}
      应用到本页
    </Button>
  )
  const trigger = (
    <Button variant="outline" disabled={mode === "disabled"}>
      打开
      {
        {
          dialog: "对话框",
          drawer: "底部抽屉",
          sheet: "侧边面板",
          popover: "浮层",
        }[id]
      }
    </Button>
  )
  let overlay
  if (id === "dialog")
    overlay = (
      <DialogUI.Dialog open={open} onOpenChange={setOpen}>
        <DialogUI.DialogTrigger asChild>{trigger}</DialogUI.DialogTrigger>
        <DialogUI.DialogContent>
          <DialogUI.DialogHeader>
            <DialogUI.DialogTitle>编辑演示视图</DialogUI.DialogTitle>
            <DialogUI.DialogDescription>
              确认名称后应用到本页。
            </DialogUI.DialogDescription>
          </DialogUI.DialogHeader>
          {fields}
          <DialogUI.DialogFooter>
            <DialogUI.DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogUI.DialogClose>
            {apply}
          </DialogUI.DialogFooter>
        </DialogUI.DialogContent>
      </DialogUI.Dialog>
    )
  else if (id === "drawer")
    overlay = (
      <DrawerUI.Drawer open={open} onOpenChange={setOpen}>
        <DrawerUI.DrawerTrigger asChild>{trigger}</DrawerUI.DrawerTrigger>
        <DrawerUI.DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerUI.DrawerHeader>
              <DrawerUI.DrawerTitle>编辑演示视图</DrawerUI.DrawerTitle>
              <DrawerUI.DrawerDescription>
                可拖动关闭；没有提交真实业务请求。
              </DrawerUI.DrawerDescription>
            </DrawerUI.DrawerHeader>
            <div className="px-4">{fields}</div>
            <DrawerUI.DrawerFooter>
              {apply}
              <DrawerUI.DrawerClose asChild>
                <Button variant="outline">取消</Button>
              </DrawerUI.DrawerClose>
            </DrawerUI.DrawerFooter>
          </div>
        </DrawerUI.DrawerContent>
      </DrawerUI.Drawer>
    )
  else if (id === "sheet")
    overlay = (
      <SheetUI.Sheet open={open} onOpenChange={setOpen}>
        <SheetUI.SheetTrigger asChild>{trigger}</SheetUI.SheetTrigger>
        <SheetUI.SheetContent>
          <SheetUI.SheetHeader>
            <SheetUI.SheetTitle>编辑演示视图</SheetUI.SheetTitle>
            <SheetUI.SheetDescription>
              当前空间：DEMO 工作室。
            </SheetUI.SheetDescription>
          </SheetUI.SheetHeader>
          <div className="px-4">{fields}</div>
          <SheetUI.SheetFooter>
            {apply}
            <SheetUI.SheetClose asChild>
              <Button variant="outline">取消</Button>
            </SheetUI.SheetClose>
          </SheetUI.SheetFooter>
        </SheetUI.SheetContent>
      </SheetUI.Sheet>
    )
  else
    overlay = (
      <PopoverUI.Popover open={open} onOpenChange={setOpen}>
        <PopoverUI.PopoverTrigger asChild>{trigger}</PopoverUI.PopoverTrigger>
        <PopoverUI.PopoverContent>
          <PopoverUI.PopoverHeader>
            <PopoverUI.PopoverTitle>演示视图设置</PopoverUI.PopoverTitle>
            <PopoverUI.PopoverDescription>
              只影响当前样本。
            </PopoverUI.PopoverDescription>
          </PopoverUI.PopoverHeader>
          {fields}
          {apply}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
        </PopoverUI.PopoverContent>
      </PopoverUI.Popover>
    )
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={[...basicModes, ["loading", "处理中样例"]]}
      />
      {overlay}
      <p role="status">已应用名称：{saved}。打开和关闭保留官方焦点行为。</p>
    </div>
  )
}

function MenuExample({
  id,
}: {
  id: "context-menu" | "dropdown-menu" | "menubar"
}) {
  const [checked, setChecked] = useState<boolean | "indeterminate">(
    "indeterminate"
  )
  const [result, setResult] = useState("未执行菜单动作")
  const [format, setFormat] = useState("列表")
  let menu
  if (id === "context-menu")
    menu = (
      <ContextUI.ContextMenu>
        <ContextUI.ContextMenuTrigger asChild>
          <Button variant="outline">右键或长按：演示课程</Button>
        </ContextUI.ContextMenuTrigger>
        <ContextUI.ContextMenuContent>
          <ContextUI.ContextMenuGroup>
            <ContextUI.ContextMenuLabel>课程视图</ContextUI.ContextMenuLabel>
            <ContextUI.ContextMenuItem
              onSelect={() => setResult("已在本页标记为稍后阅读")}
            >
              标记稍后阅读
            </ContextUI.ContextMenuItem>
            <ContextUI.ContextMenuItem disabled>
              发布到线上 · 未接通
            </ContextUI.ContextMenuItem>
            <ContextUI.ContextMenuCheckboxItem
              checked={checked}
              onCheckedChange={setChecked}
            >
              显示说明
            </ContextUI.ContextMenuCheckboxItem>
          </ContextUI.ContextMenuGroup>
        </ContextUI.ContextMenuContent>
      </ContextUI.ContextMenu>
    )
  else if (id === "dropdown-menu")
    menu = (
      <DropdownUI.DropdownMenu>
        <DropdownUI.DropdownMenuTrigger asChild>
          <Button variant="outline">课程操作</Button>
        </DropdownUI.DropdownMenuTrigger>
        <DropdownUI.DropdownMenuContent>
          <DropdownUI.DropdownMenuGroup>
            <DropdownUI.DropdownMenuLabel>
              演示课程
            </DropdownUI.DropdownMenuLabel>
            <DropdownUI.DropdownMenuItem
              onSelect={() => setResult("已在本页标记为稍后阅读")}
            >
              标记稍后阅读
            </DropdownUI.DropdownMenuItem>
            <DropdownUI.DropdownMenuCheckboxItem
              checked={checked}
              onCheckedChange={setChecked}
            >
              显示说明
            </DropdownUI.DropdownMenuCheckboxItem>
          </DropdownUI.DropdownMenuGroup>
          <DropdownUI.DropdownMenuSeparator />
          <DropdownUI.DropdownMenuGroup>
            <DropdownUI.DropdownMenuRadioGroup
              value={format}
              onValueChange={setFormat}
            >
              {["列表", "摘要"].map((item) => (
                <DropdownUI.DropdownMenuRadioItem key={item} value={item}>
                  {item}
                </DropdownUI.DropdownMenuRadioItem>
              ))}
            </DropdownUI.DropdownMenuRadioGroup>
            <DropdownUI.DropdownMenuItem disabled>
              发布到线上 · 未接通
            </DropdownUI.DropdownMenuItem>
          </DropdownUI.DropdownMenuGroup>
        </DropdownUI.DropdownMenuContent>
      </DropdownUI.DropdownMenu>
    )
  else
    menu = (
      <MenubarUI.Menubar>
        <MenubarUI.MenubarMenu>
          <MenubarUI.MenubarTrigger>课程</MenubarUI.MenubarTrigger>
          <MenubarUI.MenubarContent>
            <MenubarUI.MenubarGroup>
              <MenubarUI.MenubarItem
                onSelect={() => setResult("已创建本页演示草稿")}
              >
                新建本页草稿
              </MenubarUI.MenubarItem>
              <MenubarUI.MenubarItem disabled>
                同步到团队 · 未接通
              </MenubarUI.MenubarItem>
            </MenubarUI.MenubarGroup>
          </MenubarUI.MenubarContent>
        </MenubarUI.MenubarMenu>
        <MenubarUI.MenubarMenu>
          <MenubarUI.MenubarTrigger>视图</MenubarUI.MenubarTrigger>
          <MenubarUI.MenubarContent>
            <MenubarUI.MenubarGroup>
              <MenubarUI.MenubarCheckboxItem
                checked={checked}
                onCheckedChange={setChecked}
              >
                显示说明
              </MenubarUI.MenubarCheckboxItem>
            </MenubarUI.MenubarGroup>
          </MenubarUI.MenubarContent>
        </MenubarUI.MenubarMenu>
      </MenubarUI.Menubar>
    )
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={
          checked === "indeterminate"
            ? "mixed"
            : checked
              ? "checked"
              : "unchecked"
        }
        onChange={(value) =>
          setChecked(value === "mixed" ? "indeterminate" : value === "checked")
        }
        options={[
          ["mixed", "混合选择"],
          ["checked", "已选"],
          ["unchecked", "未选"],
        ]}
      />
      {menu}
      <p role="status">
        {result}。说明：
        {checked === "indeterminate" ? "混合状态" : checked ? "显示" : "隐藏"}
        ；布局：{format}。
      </p>
    </div>
  )
}

function CarouselExample() {
  const [mode, setMode] = useState("default")
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={[
          ["default", "完整课程"],
          ["single", "单张 · 两端禁用"],
        ]}
      />
      <div className="px-12">
        <CarouselUI.Carousel key={mode} aria-label="演示课程轮播">
          <CarouselUI.CarouselContent>
            {courses.slice(0, mode === "single" ? 1 : 3).map((title, index) => (
              <CarouselUI.CarouselItem key={title}>
                <Card>
                  <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>DEMO 课程 {index + 1}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>从练习说明开始，逐步整理作品。</p>
                  </CardContent>
                  <CardFooter>
                    <Badge variant="secondary">仅演示内容</Badge>
                  </CardFooter>
                </Card>
              </CarouselUI.CarouselItem>
            ))}
          </CarouselUI.CarouselContent>
          <CarouselUI.CarouselPrevious aria-label="上一张课程" />
          <CarouselUI.CarouselNext aria-label="下一张课程" />
        </CarouselUI.Carousel>
      </div>
      <p>可拖动或使用两侧按钮；到达边界时官方按钮禁用。</p>
    </div>
  )
}

function ChartExample() {
  const [mode, setMode] = useState("default")
  const config = {
    chapters: { label: "已整理章节", color: "var(--chart-1)" },
  } satisfies ChartUI.ChartConfig
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={[
          ["default", "示例数据"],
          ["loading", "加载中"],
          ["empty", "无数据"],
        ]}
      />
      {mode === "loading" ? (
        <div role="status">
          <Skeleton className="h-56 w-full" />
          <p>读取状态样例，没有网络请求。</p>
        </div>
      ) : mode === "empty" ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>没有章节统计</EmptyTitle>
            <EmptyDescription>切回示例数据查看图表。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ChartUI.ChartContainer
            config={config}
            className="h-56 w-full"
            aria-label="演示课程章节数柱状图"
          >
            <BarChart accessibilityLayer data={lessons}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="title" tickLine={false} axisLine={false} />
              <ChartUI.ChartTooltip content={<ChartUI.ChartTooltipContent />} />
              <Bar dataKey="chapters" fill="var(--color-chapters)" />
            </BarChart>
          </ChartUI.ChartContainer>
          <p>
            演示章节数：创作3、摄影5、剪辑2、声音4。颜色只引用全局 Wringy
            图表变量。
          </p>
        </>
      )}
    </div>
  )
}

function InfoExample({ tooltip = false }: { tooltip?: boolean }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  return (
    <div className="flex flex-col gap-4">
      {tooltip ? (
        <TooltipUI.TooltipProvider>
          <TooltipUI.Tooltip open={open} onOpenChange={setOpen}>
            <TooltipUI.TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => setCount((value) => value + 1)}
              >
                标记本页课程
              </Button>
            </TooltipUI.TooltipTrigger>
            <TooltipUI.TooltipContent>
              只增加本页标记次数，不更改课程。
            </TooltipUI.TooltipContent>
          </TooltipUI.Tooltip>
        </TooltipUI.TooltipProvider>
      ) : (
        <HoverUI.HoverCard open={open} onOpenChange={setOpen}>
          <HoverUI.HoverCardTrigger asChild>
            <Button variant="link" onClick={() => setOpen((value) => !value)}>
              DEMO 内容组
            </Button>
          </HoverUI.HoverCardTrigger>
          <HoverUI.HoverCardContent>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>DE</AvatarFallback>
              </Avatar>
              <div>
                <p>DEMO 内容组</p>
                <p>虚构演示身份 · 整理课程说明</p>
              </div>
            </div>
          </HoverUI.HoverCardContent>
        </HoverUI.HoverCard>
      )}
      <p role="status">
        {tooltip
          ? `本页标记次数：${count}。悬停或键盘聚焦查看辅助说明。`
          : "悬停或点击身份查看资料；此资料不代表真实团队。"}
      </p>
    </div>
  )
}

function NavigationExample() {
  const [page, setPage] = useState("课程")
  return (
    <div className="flex flex-col gap-4">
      <NavigationUI.NavigationMenu aria-label="本页示例导航">
        <NavigationUI.NavigationMenuList>
          <NavigationUI.NavigationMenuItem>
            <NavigationUI.NavigationMenuTrigger>
              工作空间
            </NavigationUI.NavigationMenuTrigger>
            <NavigationUI.NavigationMenuContent>
              <div className="flex w-56 flex-col gap-2">
                {["课程", "练习", "笔记"].map((item) => (
                  <NavigationUI.NavigationMenuLink
                    key={item}
                    href="#navigation-menu"
                    active={page === item}
                    onClick={(event) => {
                      event.preventDefault()
                      setPage(item)
                    }}
                  >
                    {item}
                  </NavigationUI.NavigationMenuLink>
                ))}
              </div>
            </NavigationUI.NavigationMenuContent>
          </NavigationUI.NavigationMenuItem>
          <NavigationUI.NavigationMenuItem>
            <NavigationUI.NavigationMenuTrigger disabled>
              团队入口 · 未接通
            </NavigationUI.NavigationMenuTrigger>
          </NavigationUI.NavigationMenuItem>
        </NavigationUI.NavigationMenuList>
      </NavigationUI.NavigationMenu>
      <div role="status">当前本页内容：{page} · DEMO</div>
    </div>
  )
}

function PaginationExample() {
  const [page, setPage] = useState(1)
  const anchorId = useId()
  return (
    <div className="flex flex-col gap-4">
      <div id={anchorId} role="status">
        第 {page} 页：{courses[page - 1]} · DEMO
      </div>
      <PaginationUI.Pagination aria-label="演示课程分页">
        <PaginationUI.PaginationContent>
          <PaginationUI.PaginationItem>
            <PaginationUI.PaginationPrevious
              text="上一页"
              aria-label="上一页"
              aria-disabled={page === 1}
              tabIndex={page === 1 ? -1 : 0}
              href={page > 1 ? `#${anchorId}` : undefined}
              onClick={(event) => {
                event.preventDefault()
                setPage((value) => Math.max(1, value - 1))
              }}
            />
          </PaginationUI.PaginationItem>
          {[1, 2, 3].map((item) => (
            <PaginationUI.PaginationItem key={item}>
              <PaginationUI.PaginationLink
                href={`#${anchorId}`}
                isActive={item === page}
                onClick={(event) => {
                  event.preventDefault()
                  setPage(item)
                }}
                aria-label={`第${item}页`}
              >
                {item}
              </PaginationUI.PaginationLink>
            </PaginationUI.PaginationItem>
          ))}
          <PaginationUI.PaginationItem>
            <PaginationUI.PaginationNext
              text="下一页"
              aria-label="下一页"
              aria-disabled={page === 3}
              tabIndex={page === 3 ? -1 : 0}
              href={page < 3 ? `#${anchorId}` : undefined}
              onClick={(event) => {
                event.preventDefault()
                setPage((value) => Math.min(3, value + 1))
              }}
            />
          </PaginationUI.PaginationItem>
        </PaginationUI.PaginationContent>
      </PaginationUI.Pagination>
    </div>
  )
}

function ResizableExample() {
  const [mode, setMode] = useState("horizontal")
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        label="面板方向"
        options={[
          ["horizontal", "左右面板"],
          ["vertical", "上下面板"],
        ]}
      />
      <div className="h-64">
        <ResizableUI.ResizablePanelGroup
          key={mode}
          orientation={mode === "vertical" ? "vertical" : "horizontal"}
        >
          <ResizableUI.ResizablePanel defaultSize="40%" minSize="20%">
            <div className="flex h-full items-center justify-center p-4">
              课程列表 · DEMO
            </div>
          </ResizableUI.ResizablePanel>
          <ResizableUI.ResizableHandle
            withHandle
            aria-label="调整列表与详情大小"
          />
          <ResizableUI.ResizablePanel defaultSize="60%" minSize="20%">
            <div className="flex h-full items-center justify-center p-4">
              课程详情 · 拖动分隔柄调整
            </div>
          </ResizableUI.ResizablePanel>
        </ResizableUI.ResizablePanelGroup>
      </div>
      <p>分隔柄支持拖动与官方键盘操作。</p>
    </div>
  )
}

function ScrollExample() {
  const [count, setCount] = useState(18)
  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="outline"
        onClick={() => setCount((value) => (value === 18 ? 3 : 18))}
      >
        {count === 18 ? "查看短列表" : "查看长列表"}
      </Button>
      <ScrollArea
        className="h-60 w-full"
        tabIndex={0}
        aria-label="演示课程版本记录"
      >
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <p>DEMO 版本 {index + 1} · 更新课程说明</p>
              <Separator />
            </div>
          ))}
        </div>
      </ScrollArea>
      <p>长列表可滚动；短列表保留相同容器。</p>
    </div>
  )
}

function SidebarExample() {
  const [active, setActive] = useState("课程")
  const [mode, setMode] = useState("default")
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={[
          ["default", "可选择导航"],
          ["loading", "读取导航"],
        ]}
      />
      <SidebarUI.SidebarProvider className="min-h-0">
        <SidebarUI.Sidebar collapsible="none">
          <SidebarUI.SidebarHeader>
            <p>DEMO 工作室</p>
          </SidebarUI.SidebarHeader>
          <SidebarUI.SidebarContent>
            <SidebarUI.SidebarGroup>
              <SidebarUI.SidebarGroupLabel>
                内容管理
              </SidebarUI.SidebarGroupLabel>
              <SidebarUI.SidebarGroupContent>
                <SidebarUI.SidebarMenu>
                  {mode === "loading" ? (
                    <SidebarUI.SidebarMenuItem>
                      <SidebarUI.SidebarMenuSkeleton showIcon />
                    </SidebarUI.SidebarMenuItem>
                  ) : (
                    ["课程", "练习", "笔记"].map((item) => (
                      <SidebarUI.SidebarMenuItem key={item}>
                        <SidebarUI.SidebarMenuButton
                          isActive={active === item}
                          onClick={() => setActive(item)}
                        >
                          <FolderIcon />
                          <span>{item}</span>
                        </SidebarUI.SidebarMenuButton>
                      </SidebarUI.SidebarMenuItem>
                    ))
                  )}
                  <SidebarUI.SidebarMenuItem>
                    <SidebarUI.SidebarMenuButton disabled>
                      团队同步 · 未接通
                    </SidebarUI.SidebarMenuButton>
                  </SidebarUI.SidebarMenuItem>
                </SidebarUI.SidebarMenu>
              </SidebarUI.SidebarGroupContent>
            </SidebarUI.SidebarGroup>
          </SidebarUI.SidebarContent>
          <SidebarUI.SidebarFooter>
            <Badge variant="outline">嵌入导航样本</Badge>
          </SidebarUI.SidebarFooter>
        </SidebarUI.Sidebar>
      </SidebarUI.SidebarProvider>
      <p role="status">
        当前：{active}。完整折叠与移动导航使用外层官方 Sidebar。
      </p>
    </div>
  )
}

function SonnerExample() {
  const [mode, setMode] = useState("default")
  const toasterId = useId()
  const show = () => {
    const options = {
      toasterId,
      id: toasterId,
      description: "只演示本页通知，没有外部操作。",
    }
    if (mode === "error") toast.error("模拟读取失败，请重试", options)
    else if (mode === "success") toast.success("已整理本页演示笔记", options)
    else if (mode === "loading")
      toast.loading("演示处理中 · 可手动关闭", options)
    else toast("课程笔记已更新 · DEMO", options)
  }
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={[
          ["default", "普通通知"],
          ["success", "成功样例"],
          ["error", "错误样例"],
          ["loading", "处理中样例"],
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={show}>
          显示通知
        </Button>
        <Button variant="ghost" onClick={() => toast.dismiss(toasterId)}>
          关闭演示通知
        </Button>
      </div>
      <Toaster id={toasterId} />
      <p>通知仅说明演示动作，不代表服务端保存成功。</p>
    </div>
  )
}

function TableExample() {
  const [mode, setMode] = useState("default")
  const [selected, setSelected] = useState("DEMO-01")
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={[
          ["default", "可选行"],
          ["loading", "读取中"],
          ["empty", "空表格"],
        ]}
      />
      {mode === "default" ? (
        <CourseTable selected={selected} onSelect={setSelected} />
      ) : mode === "loading" ? (
        <div role="status" className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <p>读取样例。</p>
        </div>
      ) : (
        <TableUI.Table>
          <TableUI.TableHeader>
            <TableUI.TableRow>
              <TableUI.TableHead>课程</TableUI.TableHead>
              <TableUI.TableHead>状态</TableUI.TableHead>
            </TableUI.TableRow>
          </TableUI.TableHeader>
          <TableUI.TableBody>
            <TableUI.TableRow>
              <TableUI.TableCell colSpan={2}>
                当前演示筛选没有结果。
              </TableUI.TableCell>
            </TableUI.TableRow>
          </TableUI.TableBody>
        </TableUI.Table>
      )}
      <p role="status">选择课程名称可改变本页选中行；当前：{selected}。</p>
    </div>
  )
}

function TabsExample({ directional = false }: { directional?: boolean }) {
  const [mode, setMode] = useState("default")
  const dir = mode === "rtl" ? "rtl" : "ltr"
  const tabs = (
    <TabsUI.Tabs defaultValue="overview" dir={dir}>
      <TabsUI.TabsList variant={mode === "line" ? "line" : "default"}>
        <TabsUI.TabsTrigger value="overview">课程概览</TabsUI.TabsTrigger>
        <TabsUI.TabsTrigger value="notes">练习笔记</TabsUI.TabsTrigger>
        <TabsUI.TabsTrigger value="team" disabled>
          团队 · 未接通
        </TabsUI.TabsTrigger>
      </TabsUI.TabsList>
      <TabsUI.TabsContent value="overview">
        <p>创作课程 · 3个演示章节。</p>
      </TabsUI.TabsContent>
      <TabsUI.TabsContent value="notes">
        <p>练习：用三个镜头表达一个观点。</p>
      </TabsUI.TabsContent>
    </TabsUI.Tabs>
  )
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        label={directional ? "阅读方向" : "官方标签变体"}
        options={
          directional
            ? [
                ["default", "从左到右"],
                ["rtl", "从右到左"],
              ]
            : [
                ["default", "默认"],
                ["line", "下划线"],
              ]
        }
      />
      {directional ? (
        <DirectionProvider dir={dir}>
          <div dir={dir}>{tabs}</div>
        </DirectionProvider>
      ) : (
        tabs
      )}
      <p>切换标签与方向均使用官方属性；禁用入口不响应操作。</p>
    </div>
  )
}

function KbdExample() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("尚未选择")
  return (
    <div className="flex flex-col gap-4">
      <DialogUI.Dialog open={open} onOpenChange={setOpen}>
        <DialogUI.DialogTrigger asChild>
          <Button
            variant="outline"
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
              ) {
                event.preventDefault()
                setOpen(true)
              }
            }}
            aria-keyshortcuts="Control+k Meta+k"
          >
            <SearchIcon data-icon="inline-start" />
            查找课程
            <KbdGroup>
              <Kbd>Ctrl / ⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </Button>
        </DialogUI.DialogTrigger>
        <DialogUI.DialogContent>
          <DialogUI.DialogHeader>
            <DialogUI.DialogTitle>查找演示课程</DialogUI.DialogTitle>
            <DialogUI.DialogDescription>
              只在本页选择，不导航到外部。
            </DialogUI.DialogDescription>
          </DialogUI.DialogHeader>
          <CommandUI.Command>
            <CommandUI.CommandInput
              placeholder="输入课程名称"
              aria-label="查找演示课程"
            />
            <CommandUI.CommandList>
              <CommandUI.CommandEmpty>没有匹配项。</CommandUI.CommandEmpty>
              <CommandUI.CommandGroup heading="演示课程">
                {courses.map((item) => (
                  <CommandUI.CommandItem
                    key={item}
                    value={item}
                    onSelect={() => {
                      setSelected(item)
                      setOpen(false)
                    }}
                  >
                    {item}
                  </CommandUI.CommandItem>
                ))}
              </CommandUI.CommandGroup>
            </CommandUI.CommandList>
          </CommandUI.Command>
        </DialogUI.DialogContent>
      </DialogUI.Dialog>
      <p role="status">
        {selected}。快捷键仅在此按钮聚焦时生效，也可直接点击。
      </p>
    </div>
  )
}

function AttachmentExample() {
  const [state, setState] =
    useState<
      NonNullable<ComponentProps<typeof AttachmentUI.Attachment>["state"]>
    >("done")
  const [visible, setVisible] = useState(true)
  const descriptions = {
    idle: "待处理 · 样例",
    uploading: "模拟上传 60% · 不发送文件",
    processing: "模拟解析中",
    error: "模拟格式错误 · 可切换状态重试",
    done: "TXT · 2 KB · DEMO",
  }
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={state}
        onChange={(value) => {
          if (
            value === "idle" ||
            value === "uploading" ||
            value === "processing" ||
            value === "error" ||
            value === "done"
          )
            setState(value)
        }}
        options={[
          ["idle", "待处理"],
          ["uploading", "上传中样例"],
          ["processing", "解析中样例"],
          ["error", "错误样例"],
          ["done", "完成样例"],
        ]}
      />
      {visible ? (
        <AttachmentUI.Attachment state={state}>
          <AttachmentUI.AttachmentMedia variant="icon">
            <FileTextIcon />
          </AttachmentUI.AttachmentMedia>
          <AttachmentUI.AttachmentContent>
            <AttachmentUI.AttachmentTitle>
              DEMO-课程笔记.txt
            </AttachmentUI.AttachmentTitle>
            <AttachmentUI.AttachmentDescription>
              {descriptions[state]}
            </AttachmentUI.AttachmentDescription>
          </AttachmentUI.AttachmentContent>
          <AttachmentUI.AttachmentActions>
            <AttachmentUI.AttachmentAction
              aria-label="移除本页演示附件"
              onClick={() => setVisible(false)}
            >
              <XIcon />
            </AttachmentUI.AttachmentAction>
          </AttachmentUI.AttachmentActions>
        </AttachmentUI.Attachment>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>演示附件已移除</EmptyTitle>
            <EmptyDescription>没有删除或上传真实文件。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => setVisible(true)}>
              恢复演示附件
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}

function BubbleExample() {
  const [variant, setVariant] =
    useState<NonNullable<ComponentProps<typeof BubbleUI.Bubble>["variant"]>>(
      "default"
    )
  const [liked, setLiked] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={variant}
        onChange={(value) => {
          if (
            value === "default" ||
            value === "secondary" ||
            value === "muted" ||
            value === "outline" ||
            value === "ghost" ||
            value === "destructive"
          )
            setVariant(value)
        }}
        label="官方气泡变体"
        options={[
          ["default", "默认"],
          ["secondary", "次要"],
          ["muted", "柔和"],
          ["outline", "描边"],
          ["ghost", "无底色"],
          ["destructive", "错误提示"],
        ]}
      />
      <div className="flex flex-col gap-6 pb-4">
        <BubbleUI.Bubble variant={variant}>
          <BubbleUI.BubbleContent>
            {variant === "destructive"
              ? "模拟消息未保存，草稿仍保留。"
              : "DEMO：课程说明已整理，欢迎补充练习建议。"}
          </BubbleUI.BubbleContent>
          <BubbleUI.BubbleReactions>
            <Button
              size="icon-xs"
              variant="secondary"
              aria-label="点赞此演示气泡"
              aria-pressed={liked}
              onClick={() => setLiked((value) => !value)}
            >
              {liked ? <CheckIcon /> : <ThumbsUpIcon />}
            </Button>
          </BubbleUI.BubbleReactions>
        </BubbleUI.Bubble>
        <BubbleUI.Bubble variant="muted" align="end">
          <BubbleUI.BubbleContent>
            DEMO：我会补充一个剪辑练习。
          </BubbleUI.BubbleContent>
        </BubbleUI.Bubble>
      </div>
      <p role="status">本页点赞：{liked ? "已选" : "未选"}。</p>
    </div>
  )
}

function MarkerExample() {
  const [variant, setVariant] = useState("default")
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={variant}
        onChange={setVariant}
        label="官方标记变体"
        options={[
          ["default", "普通事件"],
          ["separator", "日期分隔"],
          ["border", "底部分隔"],
        ]}
      />
      <MarkerUI.Marker
        variant={
          variant === "separator"
            ? "separator"
            : variant === "border"
              ? "border"
              : "default"
        }
        role="status"
      >
        <MarkerUI.MarkerIcon>
          {busy ? <Spinner /> : <CheckIcon />}
        </MarkerUI.MarkerIcon>
        <MarkerUI.MarkerContent>
          {busy
            ? "正在整理笔记 · 状态样例"
            : variant === "separator"
              ? "2026年9月11日 · DEMO"
              : "已整理3条演示笔记"}
        </MarkerUI.MarkerContent>
      </MarkerUI.Marker>
      <Button variant="outline" onClick={() => setBusy((value) => !value)}>
        {busy ? "切换为完成样例" : "切换为处理中样例"}
      </Button>
    </div>
  )
}

function DemoMessage({
  index,
  failed = false,
}: {
  index: number
  failed?: boolean
}) {
  const mine = index % 2 === 1
  return (
    <MessageUI.Message align={mine ? "end" : "start"}>
      <MessageUI.MessageAvatar>
        <Avatar>
          <AvatarFallback>{mine ? "DA" : "DB"}</AvatarFallback>
        </Avatar>
      </MessageUI.MessageAvatar>
      <MessageUI.MessageContent>
        <MessageUI.MessageHeader>
          {mine ? "DEMO 编辑A" : "DEMO 编辑B"}
        </MessageUI.MessageHeader>
        <BubbleUI.Bubble
          variant={failed ? "destructive" : mine ? "default" : "muted"}
          align={mine ? "end" : "start"}
        >
          <BubbleUI.BubbleContent>
            {failed
              ? "本地失败样例：课程说明草稿仍保留。"
              : `${index + 1}. ${mine ? "请补充一个构图练习。" : "可以从三个镜头的练习开始。"}`}
          </BubbleUI.BubbleContent>
        </BubbleUI.Bubble>
        <MessageUI.MessageFooter>
          {failed ? "未发送 · 无外部请求" : "本页演示记录 · 非真实会话"}
        </MessageUI.MessageFooter>
      </MessageUI.MessageContent>
    </MessageUI.Message>
  )
}

function MessageExample({ scroller = false }: { scroller?: boolean }) {
  const [mode, setMode] = useState("default")
  const [count, setCount] = useState(scroller ? 12 : 2)
  return (
    <div className="flex flex-col gap-4">
      <SampleState
        value={mode}
        onChange={setMode}
        options={[
          ["default", "示例对话"],
          ["error", "保留草稿的失败样例"],
          ["loading", "处理中样例"],
        ]}
      />
      {scroller ? (
        <div className="h-80">
          <ScrollerUI.MessageScrollerProvider autoScroll>
            <ScrollerUI.MessageScroller>
              <ScrollerUI.MessageScrollerViewport
                aria-label="演示消息记录"
                tabIndex={0}
              >
                <ScrollerUI.MessageScrollerContent>
                  {Array.from({ length: count }, (_, index) => (
                    <ScrollerUI.MessageScrollerItem
                      key={index}
                      messageId={`DEMO-message-${index}`}
                      scrollAnchor={index % 2 === 1}
                    >
                      <DemoMessage
                        index={index}
                        failed={mode === "error" && index === count - 1}
                      />
                    </ScrollerUI.MessageScrollerItem>
                  ))}
                  {mode === "loading" && (
                    <ScrollerUI.MessageScrollerItem messageId="DEMO-loading">
                      <MarkerUI.Marker role="status">
                        <MarkerUI.MarkerIcon>
                          <Spinner />
                        </MarkerUI.MarkerIcon>
                        <MarkerUI.MarkerContent>
                          等待演示回复 · 没有网络连接
                        </MarkerUI.MarkerContent>
                      </MarkerUI.Marker>
                    </ScrollerUI.MessageScrollerItem>
                  )}
                </ScrollerUI.MessageScrollerContent>
              </ScrollerUI.MessageScrollerViewport>
              <ScrollerUI.MessageScrollerButton aria-label="跳到最新演示消息" />
            </ScrollerUI.MessageScroller>
          </ScrollerUI.MessageScrollerProvider>
        </div>
      ) : (
        <MessageUI.MessageGroup>
          {Array.from({ length: count }, (_, index) => (
            <DemoMessage
              key={index}
              index={index}
              failed={mode === "error" && index === count - 1}
            />
          ))}
          {mode === "loading" && (
            <MessageUI.Message>
              <MarkerUI.Marker role="status">
                <MarkerUI.MarkerIcon>
                  <Spinner />
                </MarkerUI.MarkerIcon>
                <MarkerUI.MarkerContent>
                  等待演示回复 · 无网络请求
                </MarkerUI.MarkerContent>
              </MarkerUI.Marker>
            </MessageUI.Message>
          )}
        </MessageUI.MessageGroup>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={mode === "loading"}
          onClick={() => setCount((value) => value + 1)}
        >
          追加一条 DEMO 消息
        </Button>
        {mode === "error" && (
          <Button variant="outline" onClick={() => setMode("default")}>
            恢复本页草稿样例
          </Button>
        )}
      </div>
      <p>只追加内置演示文案，不发送用户消息。滚动与跳到最新由官方组件处理。</p>
    </div>
  )
}

const dataFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { text: sortFn_text },
})
const columnHelper = createColumnHelper<
  typeof dataFeatures,
  (typeof lessons)[number]
>()
const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    filterFn: "includesString",
    sortFn: "text",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        课程
        <ArrowUpDownIcon data-icon="inline-end" />
      </Button>
    ),
  }),
  columnHelper.accessor("state", { header: "状态", enableSorting: false }),
  columnHelper.accessor("chapters", { header: "章节", enableSorting: false }),
])
function DataTableExample() {
  const [search, setSearch] = useState("")
  const searchId = useId()
  const table = useTable({
    features: dataFeatures,
    columns,
    data: lessons,
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
  })
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={searchId}>筛选演示课程</FieldLabel>
          <Input
            id={searchId}
            value={search}
            placeholder="输入摄影或创作"
            onChange={(event) => {
              setSearch(event.target.value)
              table.getColumn("title")?.setFilterValue(event.target.value)
              table.setPageIndex(0)
            }}
          />
        </Field>
      </FieldGroup>
      <TableUI.Table>
        <TableUI.TableCaption>
          官方 Table + TanStack Table v9 组合 · 仅本地数据
        </TableUI.TableCaption>
        <TableUI.TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableUI.TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableUI.TableHead
                  key={header.id}
                  scope="col"
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableUI.TableHead>
              ))}
            </TableUI.TableRow>
          ))}
        </TableUI.TableHeader>
        <TableUI.TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableUI.TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableUI.TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableUI.TableCell>
                ))}
              </TableUI.TableRow>
            ))
          ) : (
            <TableUI.TableRow>
              <TableUI.TableCell colSpan={3}>
                没有匹配课程，请清除筛选。
              </TableUI.TableCell>
            </TableUI.TableRow>
          )}
        </TableUI.TableBody>
      </TableUI.Table>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          下一页
        </Button>
        <p role="status">
          第 {table.state.pagination.pageIndex + 1} 页 · 共{" "}
          {Math.max(1, table.getPageCount())} 页
        </p>
      </div>
    </div>
  )
}

export function AdvancedExample({ id }: { id: string }) {
  // Key each sample so its local state resets when the gallery changes IDs.
  switch (id) {
    case "calendar":
      return <DateExample key={id} />
    case "date-picker":
      return <DateExample key={id} picker />
    case "carousel":
      return <CarouselExample />
    case "chart":
      return <ChartExample />
    case "combobox":
    case "command":
    case "select":
      return <ChoiceExample key={id} id={id} />
    case "context-menu":
    case "dropdown-menu":
    case "menubar":
      return <MenuExample key={id} id={id} />
    case "dialog":
    case "drawer":
    case "popover":
    case "sheet":
      return <OverlayExample key={id} id={id} />
    case "hover-card":
      return <InfoExample key={id} />
    case "tooltip":
      return <InfoExample key={id} tooltip />
    case "navigation-menu":
      return <NavigationExample />
    case "pagination":
      return <PaginationExample />
    case "resizable":
      return <ResizableExample />
    case "scroll-area":
      return <ScrollExample />
    case "sidebar":
      return <SidebarExample />
    case "sonner":
      return <SonnerExample />
    case "table":
      return <TableExample />
    case "data-table":
      return <DataTableExample />
    case "tabs":
      return <TabsExample key={id} />
    case "direction":
      return <TabsExample key={id} directional />
    case "kbd":
      return <KbdExample />
    case "attachment":
      return <AttachmentExample />
    case "bubble":
      return <BubbleExample />
    case "marker":
      return <MarkerExample />
    case "message":
      return <MessageExample key={id} />
    case "message-scroller":
      return <MessageExample key={id} scroller />
    default:
      return null
  }
}
