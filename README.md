# Secret-Reichstag-Web
Secret Reichstag Web

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.

This project is a web version of a modified version of the game ["Secret Hitler"](https://www.secrethitler.com/)

## Hosting your own web client using Apache2
First, you need to clone this repo to your server or download the zip file and extract it to an appropriate location (e.g. `/var/www/secretreichstag/`).

You then need to create a new site configuration file in `/etc/apache2/sites-available/` (e.g. `secretreichstag.conf`) with the following contents
```apacheconf
<VirtualHost *:443>
	ServerName your.domain

	ServerAdmin webmaster@your.domain

	ErrorLog ${APACHE_LOG_DIR}/error.log
	CustomLog ${APACHE_LOG_DIR}/access.log combined
  
	SSLCertificateFile /path/to/your/certificate.pem
	SSLCertificateKeyFile /path/to/your/privatekey.pem
	
	DocumentRoot /var/www/secretreichstag
	
	# For insecure WebSockets. If you're using secure websockets, disable this
	ProxyPass "/sswss" "ws://localhost:34642"
	
	# For secure WebSockets, enable these
	# Note: Internally, this will always use insecure websockets. You can change this if you want
	# SSLProxyEngine On
	# ProxyPass "/sswss" "ws://localhost:34642"
</VirtualHost>
```
> Note: Make sure you don't replace the `/sswss` with something else. The web client will always try to connect to `/sswss` by default. If you want to change this behavior, you need to edit the `network.js` file

> If you don't want to use https, make sure to change the `*:443` to `*:80` and remove the `SSLCertificateFile` and `SSLCertificateKeyFile`

If you're using a path other than the default Apache2 path (inside `/var/www/`), make sure to edit the `/etc/apache2/apache2.conf` accordingly by adding the directory configuration, e.g. for `/path/to/secretreichstag`
```apacheconf
<Directory /path/to/secretreichstag/>
        Options Indexes FollowSymLinks Includes
        AllowOverride All
        Require all granted
</Directory>
```
You need to ensure that you've enabled the required modules for Apache2 using
```
a2enmod proxy proxy_http proxy_wstunnel
```
You can then enable the site using
```
a2ensite secretreichstag
```
and restart Apache using
```
systemctl restart apache2.service
```
Make sure you have a valid DNS entry for the new subdomain pointing to your server.

Afterwards, your website should be reachable under `http(s)://your.domain/`. Players using the Android app can connect to the backend server by adding the URL `ws(s)://your.domain/sswss` to their server list
