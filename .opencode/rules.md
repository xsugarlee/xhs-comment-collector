# 自动使用 rtk 节省 Token

当需要执行以下操作时，**必须优先使用 `rtk` 命令**，不要发送大段自然语言提示给模型：

- 搜索代码内容 → 使用 `rtk grep <pattern>`
- 搜索文件名 → 使用 `rtk find <pattern>`
- 读取文件内容 → 使用 `rtk cat <path>`
- 运行脚本或命令 → 使用 `rtk run <command>`

例如用户说“搜索所有 TODO”，你就应该执行 `rtk grep TODO`，而不是生成复杂的搜索提示。

例如用户说“搜索所有 TODO”，你就应该执行 `rtk grep TODO`，而不是生成复杂的搜索提示。
