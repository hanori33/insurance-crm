const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js';

function getKakaoJavascriptKey() {
  return process.env.REACT_APP_KAKAO_JAVASCRIPT_KEY || process.env.REACT_APP_KAKAO_JS_KEY || '';
}

function copyTextWithLegacyClipboard(text) {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function copyText(text) {
  if (!text) return false;

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('CLIPBOARD_API_UNAVAILABLE');
    }

    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyTextWithLegacyClipboard(text);
  }
}

export async function copyTextOrPrompt(text, successMessage = '내용을 복사했습니다.') {
  const copied = await copyText(text);
  if (copied) {
    alert(successMessage);
    return true;
  }

  window.prompt('아래 내용을 복사해주세요.', text);
  alert('자동 복사를 사용할 수 없어 내용을 직접 복사해주세요.');
  return false;
}

export function isMobileShareEnvironment(isPhone) {
  if (isPhone) return true;
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

export function loadKakaoSdk() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Kakao?.Share) return Promise.resolve(true);

  const javascriptKey = getKakaoJavascriptKey();
  if (!javascriptKey) return Promise.resolve(false);

  return new Promise((resolve) => {
    const existingScript = document.querySelector(`script[src="${KAKAO_SDK_URL}"]`);
    const initialize = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(javascriptKey);
        }
        resolve(Boolean(window.Kakao?.Share));
      } catch {
        resolve(false);
      }
    };

    if (existingScript) {
      existingScript.addEventListener('load', initialize, { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      initialize();
      return;
    }

    const script = document.createElement('script');
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.onload = initialize;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function shareTextOrCopy({
  title,
  text,
  url,
  preferNativeShare = true,
  copiedMessage = '내용을 복사했습니다.',
  canceledMessage = '공유가 취소되었습니다. 필요하면 다시 시도해주세요.',
}) {
  try {
    if (preferNativeShare && navigator.share) {
      await navigator.share({ title, text, url });
      return 'shared';
    }

    await copyTextOrPrompt([text, url].filter(Boolean).join(url && text ? '\n' : ''), copiedMessage);
    return 'copied';
  } catch (error) {
    const errorName = String(error?.name || '').toLowerCase();
    if (errorName.includes('abort')) {
      alert(canceledMessage);
      return 'canceled';
    }

    await copyTextOrPrompt([text, url].filter(Boolean).join(url && text ? '\n' : ''), copiedMessage);
    return 'copied';
  }
}

export async function shareKakaoFeedOrCopy({
  title,
  description,
  imageUrl,
  linkUrl,
  buttonTitle,
  fallbackText,
  preferKakao = true,
  preferNativeShare = true,
  copiedMessage = '내용을 복사했습니다.',
  canceledMessage = '공유가 취소되었습니다. 필요하면 다시 시도해주세요.',
}) {
  try {
    if (preferKakao) {
      const canUseKakaoShare = await loadKakaoSdk();
      if (canUseKakaoShare && window.Kakao?.Share) {
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title,
            description,
            imageUrl,
            link: {
              mobileWebUrl: linkUrl,
              webUrl: linkUrl,
            },
          },
          buttons: [
            {
              title: buttonTitle || '자세히 보기',
              link: {
                mobileWebUrl: linkUrl,
                webUrl: linkUrl,
              },
            },
          ],
        });
        return 'kakao';
      }
    }

    return shareTextOrCopy({
      title,
      text: fallbackText,
      url: linkUrl,
      preferNativeShare,
      copiedMessage,
      canceledMessage,
    });
  } catch (error) {
    const errorName = String(error?.name || '').toLowerCase();
    if (errorName.includes('abort')) {
      alert(canceledMessage);
      return 'canceled';
    }

    await copyTextOrPrompt(fallbackText, copiedMessage);
    return 'copied';
  }
}

export async function shareKakaoTextOrCopy({
  text,
  linkUrl,
  buttonTitle,
  preferKakao = true,
  preferNativeShare = true,
  copiedMessage = '내용을 복사했습니다.',
  canceledMessage = '공유가 취소되었습니다. 필요하면 다시 시도해주세요.',
}) {
  try {
    if (preferKakao) {
      const canUseKakaoShare = await loadKakaoSdk();
      if (canUseKakaoShare && window.Kakao?.Share) {
        window.Kakao.Share.sendDefault({
          objectType: 'text',
          text,
          link: {
            mobileWebUrl: linkUrl,
            webUrl: linkUrl,
          },
          buttonTitle: buttonTitle || '자세히 보기',
        });
        return 'kakao';
      }
    }

    return shareTextOrCopy({
      title: '보플랜',
      text,
      url: '',
      preferNativeShare,
      copiedMessage,
      canceledMessage,
    });
  } catch (error) {
    const errorName = String(error?.name || '').toLowerCase();
    if (errorName.includes('abort')) {
      alert(canceledMessage);
      return 'canceled';
    }

    await copyTextOrPrompt(text, copiedMessage);
    return 'copied';
  }
}
