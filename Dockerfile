# Landing Barquisimeto 3D — servicio estático en Railway
# Sirve el sitio con nginx. Railway inyecta la variable PORT;
# la ajustamos en la configuración de nginx al arrancar.
FROM nginx:alpine

# El sitio vive en site/ y los assets en assets/.
# Dentro del contenedor ambos quedan bajo la raíz web,
# así las rutas relativas ../assets/... del HTML resuelven bien.
COPY site/ /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

CMD ["sh", "-c", "sed -i \"s/listen 80;/listen ${PORT:-80};/\" /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
