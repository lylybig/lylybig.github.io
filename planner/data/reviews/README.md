# 晚间汇报

用户可以在本地反馈页直接保存，也可以在每天睡前向秘书自然语言汇报。这里保存每次已收到的真实汇报和重排依据。

建议记录字段：date、reportedAt、completed、inProgress、blockers、energy、sleep、nextActions、planAdjustments。未提供的信息留空，不能根据计划猜测已经完成。

秘书先具体回应当天的真实推进，再根据 deadline、精力和依赖重排下一天及本周剩余日期，最后构建、检查、commit 和 push。

本地提交包含 rawNote（原文）、明确勾选的 completed、energy 和 status=pending-review。未解析的 inProgress、blockers、sleep、nextActions 保持 null；秘书读取实际内容后分析并重排，设置 processedAt、status=processed 与 planAdjustments。重复提交前一版保存在 history/。浏览器保存不会自动启动秘书。

只有真实反馈进入此目录；后端和浏览器测试使用隔离目录，不写入实际进度。
