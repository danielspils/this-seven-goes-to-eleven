---
layout: default
title: Contact
description: Send feedback, bug reports, or questions about This Seven Goes to Eleven.
---

# Contact

Questions, bugs, or backslaps — drop me a line.

<!-- AFTER A SUBMIT, Web3Forms redirects to /thanks/. That target is set in
     the Web3Forms DASHBOARD — the "Seven 11 contact" form, Settings → Redirect
     URL — and NOT anywhere in this repo, so changing anything here does not
     move it. If /thanks/ is renamed or removed, the redirect breaks silently
     and this comment is the only sign the page exists. -->
<form class="contact-form" action="https://api.web3forms.com/submit" method="POST">
  <input type="hidden" name="access_key" value="216bb3c9-826f-47b7-b0bb-b149a05cdccb">
  <input type="hidden" name="subject" value="This Seven Goes to Eleven — feedback">
  <input type="hidden" name="from_name" value="thissevengoestoeleven.com">
  <!-- Honeypot: bots fill this, humans don't. Submissions with it set are dropped. -->
  <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off">
  <label for="cf-name">Your name</label>
  <input id="cf-name" type="text" name="name" required placeholder="Jane Doe">
  <label for="cf-email">Your email</label>
  <input id="cf-email" type="email" name="email" required placeholder="you@example.com">
  <label for="cf-msg">Message</label>
  <textarea id="cf-msg" name="message" rows="7" required placeholder="What's on your mind?"></textarea>
  <button type="submit">Send</button>
</form>
