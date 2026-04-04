# 📖 Хаос-контроль — Полная инструкция по запуску
### Для полного новичка. Без пропущенных шагов.

---

## Что ты получишь в итоге

Веб-приложение для управления делами, доступное с любого устройства по ссылке вида  
`https://твой-логин.github.io/chaos-control/`

Авторизация через Google и Яндекс. Данные хранятся в облаке Firebase.

---

## Что понадобится

- Компьютер (Windows, Mac или Linux)
- Браузер Google Chrome или Firefox
- Аккаунт Google (для Firebase и GitHub)
- ~30–60 минут на первую настройку

---

# ЧАСТЬ 1: СОЗДАЁМ FIREBASE ПРОЕКТ

Firebase — это облачная база данных от Google. Бесплатного тарифа хватит на личное использование.

### Шаг 1.1 — Открой Firebase Console

1. Открой браузер
2. Перейди на https://console.firebase.google.com
3. Войди через свой аккаунт Google

---

### Шаг 1.2 — Создай новый проект

1. Нажми большую кнопку **«Создать проект»** (или «Add project»)
2. Введи название: `chaos-control` (или любое другое)
3. На следующем экране **отключи Google Analytics** (переключатель влево) — нам не нужно
4. Нажми **«Создать проект»**
5. Подожди 10–15 секунд, пока проект создаётся
6. Нажми **«Продолжить»**

---

### Шаг 1.3 — Добавь веб-приложение

1. На главной странице проекта найди иконки платформ (Android, iOS, Веб `</>`)
2. Нажми на иконку **`</>`** (Веб)
3. В поле «Псевдоним приложения» введи: `chaos-control`
4. **НЕ ставь галочку** «Также настроить Firebase Hosting»
5. Нажми **«Зарегистрировать приложение»**
6. Появится блок кода — **скопируй и сохрани его** в блокнот. Он выглядит так:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "chaos-control-xxxxx.firebaseapp.com",
  projectId: "chaos-control-xxxxx",
  storageBucket: "chaos-control-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

7. Нажми **«Продолжить в консоль»**

---

### Шаг 1.4 — Включи авторизацию Google

1. В левом меню нажми **«Authentication»** (или «Аутентификация»)
2. Нажми **«Начать»** (Get started)
3. Открой вкладку **«Sign-in method»** (Способы входа)
4. Нажми на **«Google»** в списке провайдеров
5. Переключи **«Включить»** (Enable) в положение ON
6. В поле «Адрес электронной почты службы поддержки» введи свой email
7. Нажми **«Сохранить»**

✅ Google авторизация готова!

---

### Шаг 1.5 — Включи авторизацию Яндекс (опционально)

> Если Яндекс не нужен — пропусти этот шаг. Кнопка будет, но покажет инструкцию.

#### 1.5.1 — Создай приложение в Яндекс OAuth

1. Перейди на https://oauth.yandex.ru
2. Войди через аккаунт Яндекс
3. Нажми **«Зарегистрировать новое приложение»**
4. Заполни:
   - Название: `Хаос-контроль`
   - Платформы: выбери **«Веб-сервисы»**
   - Callback URI: `https://chaos-control-XXXXX.firebaseapp.com/__/auth/handler`  
     _(замени XXXXX на ID твоего Firebase проекта — смотри в authDomain из шага 1.3)_
5. В разделе «Доступы» отметь: `login:email`, `login:info`
6. Нажми **«Создать приложение»**
7. Скопируй **Client ID** и **Client secret**

#### 1.5.2 — Добавь Яндекс в Firebase

1. Вернись в Firebase Console → Authentication → Sign-in method
2. Прокрути вниз до **«Добавить новый провайдер»**
3. Выбери **«OpenID Connect»** или **«Custom»** → нет такого? Ищи **«OIDC»**
   > Если нет — выбери тип **«Прочие»** → введи:
   - Provider ID: `yandex.com`
   - Client ID: _(из Яндекс OAuth)_
   - Client secret: _(из Яндекс OAuth)_
4. Сохрани

---

### Шаг 1.6 — Создай базу данных Firestore

1. В левом меню нажми **«Firestore Database»**
2. Нажми **«Создать базу данных»**
3. Выбери **«Production mode»** (рабочий режим)
4. Выбери ближайший регион: `europe-west3` (Франкфурт) или `europe-west1`
5. Нажми **«Готово»**

---

### Шаг 1.7 — Настрой правила безопасности Firestore

1. В Firestore нажми вкладку **«Правила»** (Rules)
2. Замени всё содержимое на:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Нажми **«Опубликовать»** (Publish)

> Это означает: каждый пользователь видит только свои данные.

---

# ЧАСТЬ 2: НАСТРАИВАЕМ КОД ПРИЛОЖЕНИЯ

### Шаг 2.1 — Открой файл firebase-config.js

Найди в папке проекта файл: `js/firebase-config.js`

Открой его в любом текстовом редакторе (Блокнот, VS Code, Notepad++).

Найди этот блок:

```javascript
const firebaseConfig = {
  apiKey:            "ТВОЙ_API_KEY",
  authDomain:        "ТВОЙ_PROJECT_ID.firebaseapp.com",
  projectId:         "ТВОЙ_PROJECT_ID",
  storageBucket:     "ТВОЙ_PROJECT_ID.appspot.com",
  messagingSenderId: "ТВОЙ_SENDER_ID",
  appId:             "ТВОЙ_APP_ID"
};
```

Замени каждое значение в кавычках на свои данные из шага 1.3.

**Пример готового файла:**
```javascript
const firebaseConfig = {
  apiKey:            "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain:        "chaos-control-12345.firebaseapp.com",
  projectId:         "chaos-control-12345",
  storageBucket:     "chaos-control-12345.appspot.com",
  messagingSenderId: "987654321098",
  appId:             "1:987654321098:web:abc123def456"
};
```

Сохрани файл.

---

# ЧАСТЬ 3: ПУБЛИКУЕМ НА GITHUB PAGES

GitHub Pages — бесплатный хостинг от GitHub. Твой сайт будет доступен по ссылке.

### Шаг 3.1 — Создай аккаунт на GitHub

1. Перейди на https://github.com
2. Нажми **«Sign up»**
3. Введи email, придумай пароль и имя пользователя (например `ivanov-ivan`)
4. Подтверди email

---

### Шаг 3.2 — Создай репозиторий

1. Войди в GitHub
2. Нажми зелёную кнопку **«New»** (вверху слева) или перейди на https://github.com/new
3. Заполни:
   - **Repository name**: `chaos-control`
   - Видимость: **Public** ✅ (обязательно, иначе GitHub Pages не работает бесплатно)
   - НЕ ставь галочки «Add README» и другие
4. Нажми **«Create repository»**

---

### Шаг 3.3 — Загрузи файлы проекта

#### Способ А: Через браузер (самый простой)

1. На странице только что созданного репозитория нажми **«uploading an existing file»** (ссылка в тексте)  
   Или нажми **«Add file»** → **«Upload files»**
2. Перетащи в окно браузера **все файлы и папки** проекта:
   - `index.html`
   - Папку `css/` (со всеми файлами внутри)
   - Папку `js/` (со всеми файлами внутри)
3. Внизу страницы нажми **«Commit changes»**

> ⚠️ **Важно**: GitHub не позволяет загружать пустые папки. Убедись что внутри `css/` и `js/` есть файлы.

#### Способ Б: Через Git (для тех кто не боится командной строки)

1. Скачай и установи Git: https://git-scm.com/downloads
2. Открой Терминал (Mac/Linux) или **Git Bash** (Windows — устанавливается вместе с Git)
3. Перейди в папку проекта командой:
   ```
   cd путь/до/папки/chaos-control
   ```
4. Выполни команды по очереди:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/ТВОЙ_ЛОГИН/chaos-control.git
   git push -u origin main
   ```
   _(замени ТВОЙ_ЛОГИН на свой логин GitHub)_

---

### Шаг 3.4 — Включи GitHub Pages

1. Открой страницу репозитория на GitHub
2. Нажми вкладку **«Settings»** (шестерёнка, вверху)
3. В левом меню найди **«Pages»**
4. В разделе «Source» выбери:
   - Branch: **main**
   - Folder: **/ (root)**
5. Нажми **«Save»**
6. Подожди 1–3 минуты
7. Вверху появится зелёная плашка с адресом: `https://твой-логин.github.io/chaos-control/`

**Скопируй этот адрес** — это и есть твоё приложение!

---

### Шаг 3.5 — Добавь домен в Firebase (обязательно!)

Для того чтобы авторизация работала на твоём сайте, нужно добавить адрес в Firebase.

1. Вернись в Firebase Console
2. Authentication → **Sign-in method**
3. Прокрути вниз до раздела **«Authorised domains»** (Авторизованные домены)
4. Нажми **«Add domain»**
5. Введи: `твой-логин.github.io`
6. Нажми **«Add»**

✅ Теперь авторизация будет работать с твоего сайта.

---

# ЧАСТЬ 4: ПРОВЕРКА

### Шаг 4.1 — Открой приложение

1. Перейди по адресу `https://твой-логин.github.io/chaos-control/`
2. Должна открыться страница авторизации с охровым дизайном
3. Нажми **«Войти через Google»**
4. Выбери аккаунт Google
5. Должна открыться главная страница приложения

---

### Шаг 4.2 — Что делать если что-то не работает

**Белый экран или ошибки в консоли:**
1. Нажми F12 в браузере → вкладка **Console**
2. Посмотри на красные сообщения

**Ошибка `Firebase: Error (auth/unauthorized-domain)`:**
→ Ты не добавил домен в Firebase (повтори шаг 3.5)

**Ошибка `Failed to load resource`:**
→ Возможно путь к файлу неправильный. Проверь что все файлы загружены в GitHub.

**Кнопка входа не реагирует:**
→ Проверь что в `firebase-config.js` правильно вставлены твои данные

**Данные не сохраняются:**
→ Проверь правила Firestore (шаг 1.7) — они должны быть опубликованы

---

# ЧАСТЬ 5: ОБНОВЛЕНИЕ ПРИЛОЖЕНИЯ

Когда захочешь добавить изменения в код:

### Через браузер:
1. Открой нужный файл в репозитории GitHub
2. Нажми иконку карандаша ✏️ (Edit file)
3. Внеси изменения
4. Нажми **«Commit changes»**
5. Подожди 1–2 минуты — изменения появятся на сайте автоматически

### Через Git:
```bash
git add .
git commit -m "Описание изменений"
git push
```

---

# ЧАСТЬ 6: КАК ДОБАВИТЬ НОВЫЙ МОДУЛЬ

Приложение сделано модульным. Чтобы добавить новый раздел (например «Привычки»):

### 1. Добавь пункт меню в `index.html`

Найди комментарий `<!-- MODULES_NAV_PLACEHOLDER -->` и добавь перед ним:
```html
<li><a href="#" class="nav-item" data-module="habits"><span class="nav-icon">⊕</span>Привычки</a></li>
```

### 2. Добавь контейнер для модуля в `index.html`

Найди `<!-- MODULES_VIEW_PLACEHOLDER -->` и добавь:
```html
<div id="module-habits" class="module"></div>
```

### 3. Создай файл модуля `js/modules/habits.js`

```javascript
import { registerModule } from "../router.js";

const container = document.getElementById("module-habits");

async function render() {
  container.innerHTML = `<h2>Привычки</h2><p>Здесь будут привычки</p>`;
}

export function initHabits() {
  registerModule("habits", render);
}
```

### 4. Подключи модуль в `app.js`

Добавь в начало:
```javascript
import { initHabits } from "./modules/habits.js";
```

Добавь в функцию `onLogin`:
```javascript
initHabits();
```

### 5. Добавь название в `router.js`

```javascript
const moduleNames = {
  // ... существующие ...
  habits: "Привычки",
};
```

---

# СТРУКТУРА ФАЙЛОВ

```
chaos-control/
├── index.html              ← Главная страница (точка входа)
├── css/
│   ├── main.css            ← Переменные, layout, общие стили
│   ├── auth.css            ← Экран авторизации
│   ├── dashboard.css       ← Главная страница
│   ├── plan.css            ← План дня
│   ├── projects.css        ← Проекты + Место хаоса
│   ├── chaos.css           ← (placeholder)
│   └── modal.css           ← Модальные окна
└── js/
    ├── firebase-config.js  ← 🔧 ТВОИ ДАННЫЕ FIREBASE (редактируй!)
    ├── auth.js             ← Авторизация Google/Яндекс
    ├── db.js               ← Все операции с базой данных
    ├── modal.js            ← Модальные окна и тосты
    ├── router.js           ← Переключение между модулями
    ├── app.js              ← Главный файл запуска
    └── modules/
        ├── dashboard.js    ← Модуль «Главная»
        ├── plan.js         ← Модуль «План дня»
        ├── projects.js     ← Модуль «Проекты»
        └── chaos.js        ← Модуль «Место хаоса»
```

---

# СТРУКТУРА ДАННЫХ В FIRESTORE

```
users/
  {userId}/
    categories/
      {catId}: { name, createdAt }
    projects/
      {projId}: { name, catId, createdAt }
    tasks/
      {taskId}: { title, projId, catId, deadline, done, note, createdAt }
    chaos/
      {itemId}: { text, createdAt }
```

---

# ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ

**Q: Сколько стоит Firebase?**  
A: Бесплатный тариф Spark позволяет 50,000 чтений и 20,000 записей в день. Для личного использования более чем достаточно.

**Q: Безопасны ли мои данные?**  
A: Да. Правила Firestore настроены так, что каждый пользователь видит только свои данные. Никто другой не имеет доступа.

**Q: Можно ли использовать на телефоне?**  
A: Да, сайт адаптирован под мобильные устройства.

**Q: Как добавить второго пользователя?**  
A: Просто отправь ему ссылку на сайт. Каждый входит через свой Google аккаунт и получает отдельное хранилище данных.

**Q: Что если я хочу собственный домен (не github.io)?**  
A: В настройках GitHub Pages можно указать свой домен. Потребуется купить домен (~500-1000р/год) и настроить DNS записи.

---

*Если что-то не получается — проверь раздел «Что делать если что-то не работает» или открой консоль браузера (F12) и посмотри на ошибки.*
