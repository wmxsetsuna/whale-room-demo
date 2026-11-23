# 蓝白鲸语

小蓝鲸可以在房间和鲸蓝菜园之间往返，两个场景都支持跟随深圳天色切换和手动预览。

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
- 点击地面指路。房间里点床可睡觉，点书桌可播放坐姿动作，点窗下软垫可跳上平台看天。进出床和书桌会播放「鲸光闪烁」。
- 开启「自由活动」后，小蓝鲸会根据深圳天色选择活动，抵达后停留一段时间，连续两次选择不同的活动。农场里的路线会绕开菜地、池塘和工具篮。
- 右侧可预览 19 个动作、暂停、调节行走节奏和角色大小，也可显示行走范围与路线。

## 继续修改

| 想改的内容 | 入口 |
| --- | --- |
| 侧边栏和场景界面 | [HTML 模板](index.template.html)、[样式](src/style.css) |
| 场景切换、角色控制、家具互动 | [app.js](src/app.js) |
| 行走范围和活动选择 | [navigation.js](src/navigation.js)、[free-activities.js](src/free-activities.js)、[农场场景配置](assets/farm/scene.json) |
| 房间、菜园和角色贴图 | [房间](assets/scene)、[房间天色](assets/time-scenes)、[农场](assets/farm)、[角色动作素材](vendor/whale/tex) |

修改源码或素材后，运行 `npm run build`，刷新浏览器验证。玩法细节可查 [使用说明](使用说明.txt)，历次测试和已经修过的问题可查 [验证记录](验证记录.txt)。

[代码许可证](vendor/LICENSE) · [第三方素材声明](vendor/THIRD_PARTY_NOTICES.md)
