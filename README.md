## Admin Setup

## file config
Add
```
    "jwt_secret": "xxxxx",
    "auth_cookie": "auth",
```
to `config.json`

add `nconf.set('main_site_url', 'http://localhost:3000/');` in app.js

## Manage -> Categories
- Announcements
**description**: Announcements regarding our community
**privileges**: disable `Create topics` for `registered users`

- General Discussion
**description**: A place to talk about whatever you want

- Comments & Feedback
**description**: Got a question? Ask away!

- Problem discussion
**description**: Can't solve a practice problem? Ask questions here.
**privileges**: disable `Create topics` for `registered users`
**icon** code


## Settings -> General
- set **Site Title** to `RestCoder`


## Settings -> Reputation
Disable

## Settings -> Email
- set **Email Address** to `noreply@restcoder.com`
- set **From Name** to `restcoder`


## Settings -> User
1. Authentication
    - uncheck **Allow local login**
2. Account Settings
    - check all except **Allow account deletion**
3. Themes 
    - check **Prevent users from choosing a custom skin**
4. User Registration
    - select **no registration**
5. Default User Settings
check:
    - **Send an email when replies are made to topics I am subscribed to**
    - **Follow topics you create**
    - **Follow topics that you reply to**


## Settings -> Post
1. Posting Restrictions
    - set `10` for **Seconds between Posts** and **Seconds between Posts for New Users**
    

## Settings -> Chat
disable


## Settings -> Pagination
Check **Paginate topics and posts instead of using infinite scroll.**

## Extra Plugins:
- nodebb-plugin-emailer-mailgun
- nodebb-plugin-write-api


## Plugins -> Emailer (MailGun)
- setup **API Key**
- Domain `restcoder.com`


## Plugins -> Write API
- Generate User token for **uid** `1`
- Generate master token


## Redis commands:
display all values of user: `hgetall user:1`
update: 
```
hset user:1 username your_username
hset user:1 userslug your_username
hset user:1 email your@email.com
```
