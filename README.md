# 新生百科全书

## 本地运行

需要 Node.js 22.5 或更高版本。

Windows 用户可直接双击 `启动网站.cmd`，按提示设置至少 8 位的创建者管理密码。

也可以使用 PowerShell：

PowerShell：

```powershell
$env:ADMIN_PASSWORD="设置一个足够长的创建者密码"
$env:SESSION_SECRET="设置一个随机长字符串"
node server.js
```

然后打开 `http://localhost:3000`。

## 环境变量

- `ADMIN_PASSWORD`：创建者管理密码，必须设置。
- `SESSION_SECRET`：登录会话签名密钥，生产环境必须设置为随机长字符串。
- `PORT`：服务端口，默认 `3000`。
- `DB_PATH`：SQLite 数据库路径，默认 `data/community.sqlite`。
- `TRUST_PROXY`：部署在可信反向代理后设为 `true`。
- `NODE_ENV=production`：启用 Secure Cookie，生产环境应设置。

## 权限

- 所有访客可以填写称呼并在问题下提交经验补充。
- 新补充默认进入待审核状态，审核通过前不会公开显示。
- 创建者登录管理模式后，可以通过公开、撤回公开、编辑或删除任何回答。
- 普通访客看不到管理按钮，服务器也会拒绝未授权审核、编辑和删除请求。

## 年度内容迭代

1. 按迎新时间收集并去重新生问题，归入现有主题或新建栏目。
2. 先核对学校官网、入学须知和辅导员通知，发布基础答案。
3. 开放补充回答区，收集高年级学生的经验与不同情况。
4. 创建者审核补充内容，只保留有用、可核实、无隐私和广告的信息。
5. 次年集中复核政策、地址、费用、流程等易变化内容，归档旧版并发布新版本。

## 部署说明

这是带 Node.js 后端的动态网站，不能再只上传到普通的纯静态托管。需要部署到支持 Node.js 的平台，并持久化 `data/community.sqlite` 所在目录；多实例部署时应改用 PostgreSQL 或 MySQL。

项目已包含 `Dockerfile` 和 `render.yaml`，可以通过 Render、Railway、Zeabur 等支持 Docker 的平台部署。部署时至少配置：

- `ADMIN_PASSWORD`：固定的创建者管理密码。
- `SESSION_SECRET`：随机长字符串，必须长期保持不变。
- `NODE_ENV=production`。
- `DB_PATH=/var/data/community.sqlite`。
- `TRUST_PROXY=true`。

必须将持久化磁盘挂载到 `/var/data`。如果没有持久化存储，网站重新部署后补充回答会丢失。部署完成后访问 `/api/health`，返回 `{"status":"ok"}` 表示服务正常。
