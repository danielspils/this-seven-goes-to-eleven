# thissevengoestoeleven.com

Website for **This Seven Goes to Eleven**, backup and setlist software for the
Crumar Seven. Static Jekyll site served by GitHub Pages from `/docs` on `main`.

The application itself lives in a separate repository:
<https://github.com/danielspils/crumar-seven-editor>

## Layout

    docs/
      _config.yml        site config (no theme — layouts and CSS are ours)
      _layouts/          default + post
      _posts/            Notes entries
      assets/css/        the only stylesheet
      index.md           home
      notes/             Notes index
      CNAME              custom domain

## Local preview

    cd docs && jekyll serve

Pushing to `main` publishes.
