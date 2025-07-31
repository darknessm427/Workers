# Clean IP Scanner Telegram Bot

[**🇬🇧English**](#-english) | [**🇮🇷فارسی**](#-فارسی)

#### [Bot example](https://t.me/Ip_finder_scanbot) 
##### [Webhook setup tool](https://darknessm427.github.io/Workers/)
#### [نمونه بات](https://t.me/Ip_finder_scanbot)
##### [ابزار ست کردن وب هوک](https://darknessm427.github.io/Workers/)

A powerful Telegram bot built on **Cloudflare Workers** to find clean IPs from Cloudflare, Fastly, and WARP services. It's fast, serverless, and easy to deploy.

---
## 🇬🇧 English

### ✨ Features

-   **Multi-Source Scanning**: Finds IPs from Cloudflare, Fastly, and WARP ranges.
-   **Custom Range Scan**: Allows users to input their own CIDR range for scanning.
-   **Interactive Menus**: A fully button-based (inline keyboard) UI for easy navigation.
-   **Admin Panel**:
    -   Enable or disable the bot for public users.
    -   View usage statistics (total users, scans today).
-   **Serverless**: Runs entirely on Cloudflare Workers, requiring no dedicated server.
-   **Stateful Interactions**: Uses Cloudflare KV to manage user state during multi-step processes.
-   **Optimized & Fast**: Asynchronous code and efficient scanning logic provide quick results.

---

### 🚀 Deployment Guide

Follow these steps to deploy your own instance of the bot.

#### Prerequisites

1.  A **Cloudflare Account**.
2.  A **Telegram Bot Token**. Get one from [@BotFather](https://t.me/BotFather).
3.  Your personal **Telegram User ID**. Get it from [@userinfobot](https://t.me/userinfobot).

#### Step 1: Create a Cloudflare Worker and KV Namespace

1.  Log in to your Cloudflare dashboard.
2.  Go to **Workers & Pages** > **Create application** > **Create Worker**.
3.  Give your worker a name (e.g., `ip-scanner-bot`) and click **Deploy**.
4.  After deployment, go to your worker's page and click on the **Settings** tab.
5.  Scroll down to **KV Namespace Bindings** and click **Add binding**.
    -   **Variable name**: `BOT_STATE`
    -   **KV namespace**: Create a new namespace with any name (e.g., `bot_storage`).

#### Step 2: Configure Secrets

1.  In the same **Settings** tab, go to the **Variables** section.
2.  Under **Secret Variables**, click **Add variable** and add the following two secrets:
    -   **Variable name**: `BOT_TOKEN`
        -   **Value**: Paste your Telegram bot token here.
    -   **Variable name**: `ADMIN_ID`
        -   **Value**: Paste your numeric Telegram user ID here.
3.  Ensure you click **Encrypt** for both variables.

#### Step 3: Deploy the Code

1.  Go back to your worker's main page and click **Quick edit**.
2.  Delete all the default code in the editor.
3.  Copy the full code from the `worker.js` file of this project and paste it into the editor.
4.  Click **Save and deploy**.

#### Step 4: Set the Telegram Webhook

1.  Your worker has a public URL, like `https://ip-scanner-bot.your-username.workers.dev`. Copy this URL.
2.  Open a new browser tab and construct the following URL, replacing the placeholders:
    ```
    [https://api.telegram.org/bot](https://api.telegram.org/bot)<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
    ```
    -   Replace `<YOUR_BOT_TOKEN>` with your bot's token.
    -   Replace `<YOUR_WORKER_URL>` with your worker's URL.
3.  Visit the URL. If you see a success message (`{"ok":true,"result":true,...}`), your bot is now live! Go to Telegram and send the `/start` command to your bot.

---
## 🇮🇷 فارسی

### ✨ ویژگی‌ها

-   **اسکن چند منبعی**: قابلیت یافتن آی‌پی از رنج‌های Cloudflare، Fastly و WARP.
-   **اسکن رنج دلخواه**: به کاربران اجازه می‌دهد تا رنج CIDR مورد نظر خود را برای اسکن وارد کنند.
-   **منوهای تعاملی**: رابط کاربری کاملاً مبتنی بر دکمه‌های شیشه‌ای برای استفاده آسان.
-   **پنل مدیریت**:
    -   فعال یا غیرفعال کردن ربات برای کاربران عمومی.
    -   مشاهده آمار استفاده (تعداد کل کاربران، اسکن‌های امروز).
-   **بدون نیاز به سرور (Serverless)**: به طور کامل روی Cloudflare Workers اجرا می‌شود و نیازی به سرور اختصاصی ندارد.
-   **تعاملات هوشمند**: از Cloudflare KV برای مدیریت وضعیت کاربر در فرآیندهای چندمرحله‌ای استفاده می‌کند.
-   **بهینه و سریع**: کد ناهمگام و منطق اسکن بهینه، نتایج را به سرعت ارائه می‌دهد.

---

### 🚀 راهنمای نصب و راه‌اندازی

برای راه‌اندازی نسخه شخصی خود از این ربات، مراحل زیر را دنبال کنید.

#### پیش‌نیازها

1.  یک **اکانت Cloudflare**.
2.  یک **توکن ربات تلگرام**. آن را از [@BotFather](https://t.me/BotFather) دریافت کنید.
3.  **شناسه کاربری عددی** تلگرام خودتان. آن را از [@userinfobot](https://t.me/userinfobot) دریافت کنید.

#### مرحله ۱: ساخت Cloudflare Worker و فضای ذخیره‌سازی KV

1.  وارد داشبورد کلودفلر خود شوید.
2.  به بخش **Workers & Pages** بروید و روی **Create application** > **Create Worker** کلیک کنید.
3.  یک نام برای Worker خود انتخاب کنید (مثلاً `ip-scanner-bot`) و روی **Deploy** کلیک کنید.
4.  پس از ساخته شدن، وارد صفحه Worker خود شده و به تب **Settings** بروید.
5.  به بخش **KV Namespace Bindings** رفته و روی **Add binding** کلیک کنید.
    -   **Variable name**: `BOT_STATE`
    -   **KV namespace**: یک فضای نام جدید با هر اسمی بسازید (مثلاً `bot_storage`).

#### مرحله ۲: تنظیم متغیرهای امن (Secrets)

1.  در همان تب **Settings**، به بخش **Variables** بروید.
2.  زیر قسمت **Secret Variables**، روی **Add variable** کلیک کرده و دو متغیر زیر را اضافه کنید:
    -   **Variable name**: `BOT_TOKEN`
        -   **Value**: توکن ربات تلگرام خود را اینجا وارد کنید.
    -   **Variable name**: `ADMIN_ID`
        -   **Value**: شناسه عددی تلگرام خود را اینجا وارد کنید.
3.  مطمئن شوید که برای هر دو متغیر، گزینه **Encrypt** را فعال کرده‌اید.

#### مرحله ۳: قرار دادن کد

1.  به صفحه اصلی Worker خود بازگردید و روی **Quick edit** کلیک کنید.
2.  تمام کدهای پیش‌فرض موجود در ویرایشگر را حذف کنید.
3.  کد کامل فایل `worker.js` این پروژه را کپی کرده و در ویرایشگر قرار دهید.
4.  روی **Save and deploy** کلیک کنید.

#### مرحله ۴: تنظیم Webhook تلگرام

1.  آدرس عمومی Worker شما چیزی شبیه به `https://ip-scanner-bot.your-username.workers.dev` است. این آدرس را کپی کنید.
2.  در یک تب جدید مرورگر، آدرس زیر را بر اساس اطلاعات خود تکمیل کنید:
    ```
    [https://api.telegram.org/bot](https://api.telegram.org/bot)<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
    ```
    -   به جای `<YOUR_BOT_TOKEN>` توکن ربات خود را قرار دهید.
    -   به جای `<YOUR_WORKER_URL>` آدرس Worker خود را قرار دهید.
3.  آدرس ساخته شده را در مرورگر باز کنید. اگر پیام موفقیت‌آمیز (`{"ok":true,"result":true,...}`) را مشاهده کردید، ربات شما فعال شده است! به تلگرام رفته و دستور `/start` را برای ربات خود ارسال کنید.
