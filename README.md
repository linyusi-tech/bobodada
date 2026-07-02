# bobodada.cn

Static birthday site deployed with Vercel or GitHub Pages.

## Wish Pool Feishu Save

The wish form posts to `/api/wishes`. The API appends each wish to the Feishu document configured by `FEISHU_WISH_DOC_URL`.

Local development:

```sh
cp .env.example .env.local
# Fill FEISHU_APP_ID and FEISHU_APP_SECRET in .env.local.
npm run dev
```

Then open the printed local URL, for example `http://127.0.0.1:8036/`.

Online deployment:

Deploy the whole site to Vercel and add the same Feishu variables in Vercel Project Settings. `/api/wishes` will work on the same domain.

Do not commit `.env.local`.

Update flow:

```sh
git add index.html assets images audio photos api lib CNAME .nojekyll .gitignore README.md LICENSE.txt package.json
git commit -m "Update birthday site"
git push
```
