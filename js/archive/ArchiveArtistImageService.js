/**
 * ArchiveArtistImageService
 *
 * Owns artist image lookup, persistence and user-image processing. Rendering
 * remains outside this service and is requested through refreshArtists.
 */
(function attachArchiveArtistImageService(globalScope) {
  function create(context = {}) {
    const {
      storage = globalScope.localStorage,
      documentRef = globalScope.document,
      FileReaderCtor = globalScope.FileReader,
      ImageCtor = globalScope.Image,
      getDefaultArtists = () => [],
      artistKey = value => String(value || '').trim().toLowerCase(),
      refreshArtists = () => {},
      toast = () => {},
      t = globalScope.t || (k => k),
      maxSize = 512,
      maxBytes = 2 * 1024 * 1024,
      allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    } = context;

    function getBundledImage(artist) {
      return artist?.image?.type === 'bundled' && artist.image.src
        ? artist.image.src
        : null;
    }

    function get(normalizedName) {
      const key = artistKey(normalizedName);
      try {
        const userImage = storage?.getItem('arch_artist_img_' + key);
        if (userImage) return userImage;
      } catch (_) {}

      const artists = getDefaultArtists();
      const defaultArtist = artists.find(
        artist => artistKey(artist.normalizedName) === key
      );
      const bundledImage = getBundledImage(defaultArtist);
      if (bundledImage) return bundledImage;

      const aliasArtist = artists.find(artist =>
        artistKey(artist.displayName) === key ||
        artist.aliases?.some(alias => artistKey(alias) === key)
      );
      const aliasImage = getBundledImage(aliasArtist);
      if (aliasImage) return aliasImage;

      try {
        if (defaultArtist) {
          for (const oldKey of [
            defaultArtist.displayName,
            defaultArtist.id,
            defaultArtist.normalizedName
          ]) {
            if (oldKey && oldKey !== key) {
              const oldImage = storage?.getItem('arch_artist_img_' + oldKey);
              if (oldImage) {
                storage.setItem('arch_artist_img_' + key, oldImage);
                storage.removeItem('arch_artist_img_' + oldKey);
                return oldImage;
              }
            }
          }
        }
      } catch (_) {}
      return null;
    }

    function set(normalizedName, dataUrl) {
      try {
        storage?.setItem('arch_artist_img_' + normalizedName, dataUrl);
      } catch (error) {
        console.warn('Artist image save error:', error);
        toast(t('printError'));
      }
    }

    function remove(normalizedName) {
      try {
        storage?.removeItem('arch_artist_img_' + normalizedName);
      } catch (_) {}
    }

    function process(file) {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error('فایلی انتخاب نشد'));
          return;
        }
        if (!allowedTypes.includes(file.type)) {
          reject(new Error('فرمت فایل مجاز نیست (فقط PNG, JPG, WebP)'));
          return;
        }
        if (file.size > maxBytes) {
          reject(new Error('حجم فایل بیش از 2 مگابایت است'));
          return;
        }
        if (typeof FileReaderCtor !== 'function' || typeof ImageCtor !== 'function') {
          reject(new Error('امکانات پردازش تصویر در دسترس نیست'));
          return;
        }
        const reader = new FileReaderCtor();
        reader.onload = event => {
          const image = new ImageCtor();
          image.onload = () => {
            const canvas = documentRef.createElement('canvas');
            canvas.width = maxSize;
            canvas.height = maxSize;
            const canvasContext = canvas.getContext('2d');
            const minDimension = Math.min(image.width, image.height);
            const sourceX = (image.width - minDimension) / 2;
            const sourceY = (image.height - minDimension) / 2;
            canvasContext.drawImage(
              image,
              sourceX,
              sourceY,
              minDimension,
              minDimension,
              0,
              0,
              maxSize,
              maxSize
            );
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          image.onerror = () => reject(new Error('خطا در بارگذاری تصویر'));
          image.src = event.target.result;
        };
        reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
        reader.readAsDataURL(file);
      });
    }

    function pick(normalizedName, mode) {
      const input = documentRef.createElement('input');
      input.type = 'file';
      input.accept = allowedTypes.join(',');
      input.onchange = async event => {
        const file = event.target.files[0];
        if (!file) return;
        try {
          const dataUrl = await process(file);
          set(normalizedName, dataUrl);
          refreshArtists();
          toast(t('archiveSaved'));
        } catch (error) {
          toast('خطا: ' + error.message);
        }
      };
      input.click();
    }

    return Object.freeze({ get, set, remove, process, pick });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveArtistImageService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
