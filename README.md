# 蓝白鲸语

小蓝鲸可以在房间和「大肥鱼的菜园」之间往返，两个场景都支持跟随深圳天色切换和手动预览。

## 在新设备上运行

用有仓库访问权限的 GitHub 账号登录 Git，安装 Git 和带 npm 的 Node.js 22 或更新版本，再运行以下命令。

```sh
git clone https://github.com/wmxsetsuna/whale-room-demo.git
cd whale-room-demo
npm install
npm run build
```

用 Edge 或 Chrome 打开生成的 `蓝白鲸语-行走Demo.html` 即可离线体验。

## 当前功能

- 右侧「去农场」和「回房间」切换场景。两个场景都可手动测试三种天色，或按深圳日出、日落和天文暮光结束自动切换。
- 默认自由活动。点击地面即可指路，再次指路会更新目的地并重新计时。最后一次指路满 3 秒后恢复自由活动，仍在途中时会先走到指定地点。房间里点床可睡觉，点书桌可播放坐姿动作，点窗下软垫可跳上平台看天。进出床和书桌会播放「鲸光闪烁」。
- 左上拱窗显示深圳当前时间、日出日落和倒计时。日出、日落时会展开报时卷轴，点击铃铛可开关报时。场景右下的「当前房间」可展开户型图，在卧室和菜园之间切换。
- 菜园的六块木框菜床按从后向前的三行、每行两列编号。点击或轻触土面会点亮对应菜床并显示行列，也可以用 Tab 聚焦后按 Enter 或空格选中。选中的菜床会随天色切换保留，点小路可取消选中并指路。
- 在菜园自由活动时，小蓝鲸会走到空田旁，从有库存的品种中选一种播种，每块田最多种 3 株。每种下 1 株消耗 1 粒种子，途中改道会取消这次播种。田种满或种子用完后，她会继续散步、看水或休息。
- 点选菜床可查看作物、株数和生长阶段。播种时显示幼苗，经过一半成熟时间进入生长期，满期显示成熟作物。成熟天数按现实时间计算，关闭页面期间也会生长。库存消耗和已种菜床保存在当前浏览器。
- 右侧可预览 19 个动作、暂停、调节行走节奏和角色大小，也可显示行走范围与路线。

## 继续修改

| 想改的内容 | 入口 |
| --- | --- |
| 侧边栏和场景界面 | [HTML 模板](index.template.html)、[样式](src/style.css) |
| 场景切换、角色控制、家具互动 | [app.js](src/app.js) |
| 土地点击效果和每块地的轮廓 | [farm-plots.js](src/farm-plots.js)、[农场场景配置](assets/farm/scene.json) |
| 种子库的品种、库存、成熟天数和说明 | [种子配置](assets/farm/seeds.json) |
| 行走范围和活动选择 | [navigation.js](src/navigation.js)、[free-activities.js](src/free-activities.js)、[农场场景配置](assets/farm/scene.json) |
| 房间、菜园和角色贴图 | [房间](assets/scene)、[房间天色](assets/time-scenes)、[农场](assets/farm)、[角色动作素材](vendor/whale/tex) |

菜园按午后、黄昏和夜晚三份 PSD 的图层顺序绘制。要更新素材，在装有 Pillow 和 psd-tools 的 Python 环境中运行 `python assets/farm/export-layers.py "小农园三个独立PSD.zip"`。导入器会更新各图层的 PNG、坐标清单和三个时段的合成预览。

在菜园右下角点击「种子库」可查看库存。种子配置是一个 JSON 数组，按数组顺序展示；每项填写唯一的 `id`、名称 `name`、持有数量 `count`、成熟天数 `days`、季节数组 `seasons`（春、夏、秋、冬）和简介 `desc`。可用 `icon` 指定图案，内置图案名为 `carrot`、`tomato`、`cabbage`、`strawberry`、`pumpkin`、`blueberry`。省略时按 `id` 匹配，其他品种使用通用种袋。

修改 JSON 后运行 `npm run build`，本地服务和离线 HTML 都会读取新配置。已有存档的可用库存按配置数量减去已种粒数计算。对接游戏存档时，可在游戏就绪后调用 `window.SeedLibrary.setSeeds(list)`，传入当前实际可用数量，即时更新本页库存。

修改源码或素材后，运行 `npm run build`，刷新浏览器验证。玩法细节可查 [使用说明](使用说明.txt)，历次测试和已经修过的问题可查 [验证记录](验证记录.txt)。

[代码许可证](vendor/LICENSE) · [第三方素材声明](vendor/THIRD_PARTY_NOTICES.md)
