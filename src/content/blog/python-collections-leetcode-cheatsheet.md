---
title: "Python collections 刷题速查手册：Counter、defaultdict、deque 一次掌握"
description: "面向 Python 与 LeetCode 初学者的 collections 速查：一周学习路线、Counter、defaultdict、deque 的场景、模板、易错点与练习清单。"
pubDate: 2026-07-21
articleLayout: "guide"
tags: ["Python", "LeetCode", "算法", "collections", "刷题"]
draft: false
readingTime: "约 18 分钟"
---

做字符串、数组、哈希表题时，很多 Python 解法都会写：

```python
from collections import Counter, defaultdict, deque
```

它们不是遥远的“高级语法”，而是三种很实用的数据工具：**统计次数**、**自动补默认值**、**高效地从两端取元素**。这篇文章不追求把 `collections` 的所有成员背下来，而是帮你建立刷题时能立刻调用的判断：**这题该用哪个？为什么？怎么写才不容易错？**

官方完整文档在这里：[Python `collections` 文档](https://docs.python.org/zh-cn/3/library/collections.html)。遇到陌生 API 时，优先查它；本文可以作为你做题时的中文索引。

## 先记住：三件工具解决三类问题

| 工具 | 一句话用途 | 高频题型 |
| --- | --- | --- |
| `Counter` | 统计每个元素出现了几次 | 异位词、频率比较、Top K、字符计数 |
| `defaultdict` | 字典缺少键时自动提供默认值 | 分组、图邻接表、计数、前缀和 |
| `deque` | 两端都能高效加入或取出 | BFS、滑动窗口、单调队列 |

一个非常实用的选择口诀：

> 先数次数用 `Counter`；边处理边建桶用 `defaultdict`；需要先进先出或两端操作用 `deque`。

普通 `dict`、`list`、`set` 仍然是基础。`collections` 只是让某些常见写法更短、更清楚，或把时间复杂度从“可能很慢”变成“稳定高效”。

## 一周学习路线：边学边做题

每天控制在 45～90 分钟。前半段写小例子，后半段做 1～2 道题；不要只看不运行。

| 天数 | 学习重点 | 产出 |
| --- | --- | --- |
| 第 1 天 | `dict`、`set`、`enumerate` 复习；认识 `Counter` | 手写字符频率统计 |
| 第 2 天 | `Counter` 的比较、减法与 `most_common()` | 完成异位词和 Top K 题各一题 |
| 第 3 天 | `defaultdict(int)` 与 `defaultdict(list)` | 手写分组、图邻接表 |
| 第 4 天 | `deque` 队列与 BFS | 完成一题树或网格 BFS |
| 第 5 天 | `deque` 滑动窗口与单调队列 | 理解为什么不能用 `list.pop(0)` |
| 第 6 天 | 按题型混合练习 | 选 3 题，只写思路再编码 |
| 第 7 天 | 整理自己的模板与错题 | 写一页“什么时候用什么”笔记 |

学习时推荐采用这个循环：

1. 用 5 行代码验证一个 API。
2. 用它完成一道题的核心部分。
3. 把容器替换成普通写法，比较代码和复杂度。
4. 记录一个自己真正踩到的坑。

## `Counter`：把“频次统计”写得更直接

`Counter` 是专门计数的字典。键是元素，值是它出现的次数。

```python
from collections import Counter

s = "banana"
count = Counter(s)

print(count)       # Counter({'a': 3, 'n': 2, 'b': 1})
print(count['a'])  # 3
print(count['x'])  # 0
```

### 什么时候该用 `Counter`

看到下面的词，就优先想到它：

- “每个字符/数字出现几次”
- “两个字符串是否由相同字符组成”
- “找出现频率最高的 K 个元素”
- “窗口内是否已经包含所需字符”
- “剩余哪些字符还没匹配”

### 高频 API

```python
from collections import Counter

cnt = Counter([1, 1, 2, 3, 3, 3])

cnt[1]                 # 2：不存在的键读取为 0
cnt.most_common(2)     # [(3, 3), (1, 2)]：出现最多的两个
cnt.update([2, 2])     # 批量增加计数
cnt.subtract([1, 3])   # 批量减少计数，结果可以是负数
```

#### 模板 1：判断有效字母异位词

最清楚的版本就是比较两个计数器：

```python
from collections import Counter

def is_anagram(s: str, t: str) -> bool:
    return Counter(s) == Counter(t)
```

例如 `"anagram"` 和 `"nagaram"` 的每个字符次数都相同，所以结果为 `True`。

#### 模板 2：找出现频率前 K 高的元素

```python
from collections import Counter

def top_k_frequent(nums: list[int], k: int) -> list[int]:
    return [num for num, _ in Counter(nums).most_common(k)]
```

这段适合快速解题和理解题意。面试或进阶题若要求比排序更优的复杂度，再学习桶排序或堆。

#### 模板 3：滑动窗口中维护“还缺什么”

最小覆盖子串等题经常需要目标字符的数量：

```python
from collections import Counter

need = Counter("AABC")
window = Counter()

for ch in "BAAC":
    window[ch] += 1

# 判断时通常逐个比较需要的字符，而不是比较整个 Counter
is_valid = all(window[ch] >= need[ch] for ch in need)
```

这里 `need` 表示目标，`window` 表示当前窗口。窗口右移时加，左移时减。

### `Counter` 的三个易错点

1. **`Counter` 可以保留 0 和负数计数。**

   ```python
   from collections import Counter

   cnt = Counter(a=1)
   cnt.subtract("aa")
   print(cnt)  # Counter({'a': -1})
   ```

   这在“差值”场景有用；但如果你想删除无效项，需要自己清理，例如 `+cnt` 会只保留正数计数。

2. **`most_common()` 的并列顺序不要当成题目保证。**

   若题目要求并列时按数值或字母排序，要在结果上明确再排序。

3. **并非所有计数题都必须用 `Counter`。**

   滑动窗口里需要频繁 `+= 1`、`-= 1` 时，`defaultdict(int)` 常更直观；两者复杂度通常一样。

## `defaultdict`：不用反复判断“这个键存在吗”

普通字典访问不存在的键会报错：

```python
count = {}
# count['a'] += 1  # KeyError: 'a'
```

`defaultdict` 允许你指定“缺少键时应该生成什么默认值”。

```python
from collections import defaultdict

count = defaultdict(int)  # int() 的结果是 0
count['a'] += 1
count['b'] += 2
print(dict(count))  # {'a': 1, 'b': 2}
```

注意：`defaultdict(int)` 中传入的是 **工厂函数** `int`，不是 `int()`；需要默认空列表时写 `defaultdict(list)`，而不是 `defaultdict([])`。

### 三种最常用默认值

```python
from collections import defaultdict

count = defaultdict(int)   # 不存在的键 -> 0
groups = defaultdict(list) # 不存在的键 -> []
seen = defaultdict(set)    # 不存在的键 -> set()
```

### 什么时候该用 `defaultdict`

- 边遍历边计数：`defaultdict(int)`
- 按某个特征分组：`defaultdict(list)`
- 建图：`graph[u].append(v)`
- 记录某个值出现过的下标集合：`defaultdict(set)`
- 前缀和题中统计“这个前缀和出现了多少次”

#### 模板 1：按键分组

例如按单词字母组成分组：

```python
from collections import defaultdict

def group_anagrams(words: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for word in words:
        key = ''.join(sorted(word))
        groups[key].append(word)
    return list(groups.values())
```

`groups[key]` 第一次出现时自动得到新列表，因此可直接 `.append()`。

#### 模板 2：邻接表建图

```python
from collections import defaultdict

edges = [(0, 1), (0, 2), (1, 3)]
graph = defaultdict(list)

for u, v in edges:
    graph[u].append(v)
    graph[v].append(u)  # 无向图才需要这一行

print(graph[0])  # [1, 2]
```

图题中 `graph[node]` 即使没有邻居也会返回空列表，DFS/BFS 写起来很顺。

#### 模板 3：前缀和 + 计数

统计和为 `k` 的连续子数组数量：

```python
from collections import defaultdict

def subarray_sum(nums: list[int], k: int) -> int:
    prefix_count = defaultdict(int)
    prefix_count[0] = 1
    prefix = ans = 0

    for num in nums:
        prefix += num
        ans += prefix_count[prefix - k]
        prefix_count[prefix] += 1
    return ans
```

先查询 `prefix - k` 出现次数，再增加当前 `prefix`。顺序不能颠倒，否则在 `k = 0` 时可能把当前前缀和错误地算进去。

### `defaultdict` 的三个易错点

1. **读取不存在的键也会创建它。**

   ```python
   from collections import defaultdict

   d = defaultdict(int)
   print(d['missing'])  # 0
   print('missing' in d)  # True
   ```

   只想安全读取而不创建键时，使用 `d.get(key, 0)`。

2. **不要把同一个可变列表当默认值共享。**

   正确：`defaultdict(list)`，因为每个新键都会调用一次 `list()` 创建新列表。

3. **它并不会自动删除计数为 0 的键。**

   滑动窗口里减到 0 后保留键通常没问题；如果题目需要窗口不同元素个数，可在减到 0 时 `del count[ch]`。

## `deque`：队列不要再用 `list.pop(0)`

`deque` 是双端队列（double-ended queue）。它适合在左右两端都频繁操作。

```python
from collections import deque

q = deque([1, 2, 3])
q.append(4)       # 右端加入
q.appendleft(0)   # 左端加入
q.pop()           # 右端取出，得到 4
q.popleft()       # 左端取出，得到 0
```

`list.append()` 和 `list.pop()` 在右端也很快；但 `list.pop(0)` 需要移动后面所有元素，最坏是 `O(n)`。`deque.popleft()` 则是 `O(1)`，这就是 BFS 和滑动窗口常选它的原因。

### 什么时候该用 `deque`

- “一层一层扩散”或“最少步数” → BFS 队列
- 窗口左端不断离开元素 → 滑动窗口
- 需要维护候选最大值/最小值 → 单调队列
- 需要固定长度队列 → `deque(maxlen=k)`

#### 模板 1：网格 BFS 的最短路径骨架

```python
from collections import deque

def bfs(grid: list[list[int]], start: tuple[int, int]) -> int:
    rows, cols = len(grid), len(grid[0])
    q = deque([(start[0], start[1], 0)])  # 行、列、步数
    visited = {start}

    while q:
        r, c, dist = q.popleft()
        # 在这里判断是否到达终点
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in visited:
                visited.add((nr, nc))
                q.append((nr, nc, dist + 1))
    return -1
```

关键习惯：**入队时标记 `visited`**，而不是出队时。这样同一个点不会被多个方向重复塞进队列。

#### 模板 2：固定大小滑动窗口

```python
from collections import deque

def moving_average(nums: list[int], k: int) -> list[float]:
    window = deque()
    total = 0
    ans = []

    for num in nums:
        window.append(num)
        total += num
        if len(window) > k:
            total -= window.popleft()
        if len(window) == k:
            ans.append(total / k)
    return ans
```

这个模板把“加入右端”和“移除左端”写得非常直观。

#### 模板 3：单调队列求滑动窗口最大值

单调队列难点不是 API，而是**队列里保存下标，并保持对应数值从大到小**：

```python
from collections import deque

def max_sliding_window(nums: list[int], k: int) -> list[int]:
    q = deque()  # 保存下标；nums[q] 对应的值单调递减
    ans = []

    for i, num in enumerate(nums):
        while q and q[0] <= i - k:  # 队首已经离开窗口
            q.popleft()
        while q and nums[q[-1]] <= num:  # 更小的候选永远不会成为最大值
            q.pop()
        q.append(i)
        if i >= k - 1:
            ans.append(nums[q[0]])
    return ans
```

为什么存下标？因为既要知道值，也要判断它是否已经过期。每个下标最多进队和出队各一次，所以整体仍是 `O(n)`。

### `deque` 的三个易错点

1. `popleft()` 会在队列为空时报 `IndexError`；循环前写 `while q:`。
2. 单调队列里比较的是 `nums[q[-1]]`，不是下标本身。
3. `deque(maxlen=k)` 满时追加新元素会自动丢掉另一端元素。它适合固定历史记录，但算法题中若还要同步维护和、计数，手动 `popleft()` 通常更清楚。

## `Counter` 和 `defaultdict(int)` 到底怎么选？

两者都能计数；选哪个主要看意图。

| 场景 | 更推荐 | 原因 |
| --- | --- | --- |
| 一次性统计整个字符串或数组 | `Counter(data)` | 初始化就表达“统计频率” |
| 比较两个元素频率是否一致 | `Counter` | 可直接 `Counter(a) == Counter(b)` |
| 求最高频元素 | `Counter` | 有 `most_common()` |
| 遍历过程中持续增减计数 | `defaultdict(int)` | 读写逻辑简单、意图明确 |
| 前缀和、图、分组等非纯计数 | `defaultdict` | 默认值可为 `int`、`list`、`set` 等 |

例如“最长无重复子串”可以写成 `defaultdict(int)`：

```python
from collections import defaultdict

def length_of_longest_substring(s: str) -> int:
    left = ans = 0
    count = defaultdict(int)

    for right, ch in enumerate(s):
        count[ch] += 1
        while count[ch] > 1:
            count[s[left]] -= 1
            left += 1
        ans = max(ans, right - left + 1)
    return ans
```

其中 `count[s[left]] -= 1` 的意思是：`left` 是当前窗口左边界，左边界准备右移之前，先把即将离开窗口的字符从计数中移除。

## 按题型选择工具：刷题地图

| 题型或关键词 | 第一反应 | 代表题目 |
| --- | --- | --- |
| 是否为异位词、字符频率 | `Counter` | 有效的字母异位词、赎金信 |
| 频率最高的 K 个元素 | `Counter().most_common()`（入门） | 前 K 个高频元素 |
| 按规律分组 | `defaultdict(list)` | 字母异位词分组 |
| 图的边、课程依赖、账户合并 | `defaultdict(list)` | 课程表、克隆图 |
| 前缀和出现次数 | `defaultdict(int)` | 和为 K 的子数组 |
| 最短步数、层序遍历、腐烂扩散 | `deque` | 二叉树层序遍历、腐烂的橘子 |
| 固定窗口最大/最小值 | `deque` 单调队列 | 滑动窗口最大值 |
| 去重、快速判断是否存在 | `set` | 两数之和、最长连续序列 |

不要为了使用某个工具而使用它。看到题目后先问：我需要维护的是**次数**、**分组关系**、还是**等待处理的顺序**？答案通常就会指向合适的容器。

## 其他成员：现在只需知道它们的位置

### `namedtuple`

`namedtuple` 可以创建“有字段名的元组”：

```python
from collections import namedtuple

Point = namedtuple('Point', ['x', 'y'])
p = Point(2, 3)
print(p.x, p.y)  # 2 3
```

它比 `(2, 3)` 可读性更好，但新 Python 代码通常优先考虑 `dataclasses.dataclass`。LeetCode 中知道即可，出现频率远低于前三者。

### `ChainMap`

`ChainMap` 可以把多个字典当作一个“按顺序查找”的映射来读：

```python
from collections import ChainMap

defaults = {'color': 'blue', 'size': 'M'}
user = {'color': 'black'}
settings = ChainMap(user, defaults)
print(settings['color'])  # black
print(settings['size'])   # M
```

它在配置覆盖场景有用，刷题中较少。初学阶段不需要刻意练。

## 建议完成的练习清单

按顺序做，重点是“写完后能解释为什么选这个容器”。题号以 LeetCode 为例。

- `Counter`：242 有效的字母异位词、383 赎金信、347 前 K 个高频元素。
- `defaultdict(list)`：49 字母异位词分组、133 克隆图。
- `defaultdict(int)`：3 无重复字符的最长子串、560 和为 K 的子数组。
- `deque` BFS：102 二叉树的层序遍历、994 腐烂的橘子、542 01 矩阵。
- `deque` 单调队列：239 滑动窗口最大值。

做完每题后，给自己回答这四个问题：

1. 为什么普通 `dict` / `list` 不够直接或不够快？
2. 容器中的键、值或下标分别代表什么？
3. 每次循环不变的条件是什么？
4. 空输入、重复元素、窗口边界会怎样？

## 最后的速记卡

```python
from collections import Counter, defaultdict, deque

# 统计
freq = Counter(nums)

# 自动从 0 开始计数
count = defaultdict(int)
count[x] += 1

# 自动创建分组列表 / 图邻接表
groups = defaultdict(list)
groups[key].append(value)

# BFS 队列 / 从左端弹出
q = deque([start])
node = q.popleft()
```

现在不必记住 `collections` 的全部 API。把 `Counter`、`defaultdict`、`deque` 用熟，再回头阅读[官方 collections 文档](https://docs.python.org/zh-cn/3/library/collections.html)时，你会发现每一个方法都有具体使用场景，而不再只是一串需要背诵的名字。
