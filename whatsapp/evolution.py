"""Cliente HTTP explícito para Evolution GO e Evolution API."""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


class EvolutionProviderError(RuntimeError):
    """Erro de comunicação ou configuração do gateway Evolution."""


def _redact(value: str) -> str:
    clean = str(value or '')
    return f'{clean[:4]}***' if len(clean) > 4 else '***'


def evolution_is_connected(payload) -> bool:
    """Identifica se a sessão do aparelho WhatsApp está autenticada."""
    if not isinstance(payload, dict):
        return False

    for key, value in payload.items():
        norm_key = str(key).replace('-', '_').replace(' ', '_').lower()
        if norm_key == 'loggedin' and value is False:
            return False
        if isinstance(value, dict) and not evolution_is_connected(value):
            nested_logged_out = any(
                str(nk).replace('-', '_').replace(' ', '_').lower()
                == 'loggedin'
                and nv is False
                for nk, nv in value.items()
            )
            if nested_logged_out:
                return False

    connected_keys = {
        'connected',
        'connectionstatus',
        'connection_state',
        'state',
        'status',
    }
    active_values = {
        'connected',
        'open',
        'online',
        'ready',
        'authenticated',
    }

    for key, value in payload.items():
        norm_key = str(key).replace('-', '_').replace(' ', '_').lower()
        if norm_key in connected_keys:
            if value is True:
                return True
            if (
                isinstance(value, str)
                and value.strip().lower() in active_values
            ):
                return True
        if isinstance(value, dict) and evolution_is_connected(value):
            return True
    return False


class EvolutionClient:
    """Encapsula chamadas REST para Evolution GO e Evolution API legada."""

    def __init__(
        self,
        *,
        base_url=None,
        token=None,
        provider=None,
        opener=None,
    ):
        raw_provider = provider or getattr(
            settings,
            'EVOLUTION_PROVIDER',
            'evolution_go',
        )
        self.provider = str(raw_provider).lower()
        if self.provider not in {'legacy', 'evolution_go'}:
            raise ValueError(
                f'Provedor Evolution não suportado: {self.provider}'
            )
        raw_url = (
            base_url
            if base_url is not None
            else getattr(settings, 'EVOLUTION_API_URL', '')
        )
        self.base_url = str(raw_url or '').strip().rstrip('/')
        raw_token = (
            token
            if token is not None
            else getattr(settings, 'EVOLUTION_API_KEY', '')
        )
        self.token = str(raw_token or '').strip()
        self.opener = opener or urllib.request.urlopen

    @classmethod
    def from_settings_obj(cls, cfg, *, opener=None):
        return cls(
            base_url=cfg.effective_api_url(),
            token=cfg.effective_api_token(),
            provider=cfg.provider,
            opener=opener,
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url and self.token)

    def _request(self, method: str, path: str, payload=None):
        if not self.is_configured:
            raise EvolutionProviderError(
                'Servidor Evolution não está configurado.'
            )
        body = (
            json.dumps(payload).encode('utf-8')
            if payload is not None
            else None
        )
        headers = {'apikey': self.token}
        if body is not None:
            headers['Content-Type'] = 'application/json'

        url = f"{self.base_url}/{path.lstrip('/')}"
        logger.info(
            'Evolution %s %s (token=%s)',
            method,
            url,
            _redact(self.token),
        )
        req = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method=method,
        )
        timeout = getattr(settings, 'EVOLUTION_TIMEOUT', 8)
        try:
            with self.opener(req, timeout=timeout) as resp:
                raw_data = resp.read().decode('utf-8')
                return json.loads(raw_data) if raw_data else {}
        except urllib.error.HTTPError as exc:
            try:
                err_body = exc.read().decode('utf-8', errors='replace')
            except Exception:
                err_body = ''
            logger.warning(
                'Evolution HTTP %s: %s %s body=%s',
                exc.code,
                method,
                url,
                err_body[:400],
            )
            raise EvolutionProviderError(
                f'Evolution retornou HTTP {exc.code}'
            ) from exc
        except Exception as exc:
            logger.warning(
                'Falha na chamada Evolution: %s %s (%s)',
                method,
                url,
                type(exc).__name__,
            )
            raise EvolutionProviderError(
                'Não foi possível conectar ao servidor Evolution.'
            ) from exc

    def send_text(self, number: str, text: str, *, instance=None, delay=None):
        if self.provider == 'legacy':
            if not instance:
                raise EvolutionProviderError(
                    'Evolution legado requer nome da instância.'
                )
            path = f'message/sendText/{instance}'
        else:
            path = 'send/text'
        payload = {'number': str(number), 'text': str(text)}
        if delay:
            payload['delay'] = int(delay)
        return self._request('POST', path, payload)

    def send_presence(
        self,
        number: str,
        *,
        instance=None,
        presence='composing',
    ):
        if self.provider == 'legacy':
            if not instance:
                raise EvolutionProviderError(
                    'Evolution legado requer nome da instância.'
                )
            path = f'message/presence/{instance}'
            payload = {'number': str(number), 'presence': presence}
        else:
            path = 'message/presence'
            payload = {'number': str(number), 'state': presence}
        return self._request('POST', path, payload)

    def qr(self, *, instance=None):
        if self.provider == 'legacy':
            path = f'instance/connect/{instance}'
        else:
            path = 'instance/qr'
        return self._request('GET', path)

    def configure_webhook(self, webhook_url: str, *, subscribe=None):
        if self.provider != 'evolution_go':
            return {}
        events = list(subscribe or ('MESSAGE', 'BUTTON_CLICK', 'CONNECTION'))
        payload = {
            'webhookUrl': str(webhook_url),
            'subscribe': events,
        }
        return self._request('POST', 'instance/connect', payload)

    def status(self, *, instance=None):
        if self.provider == 'legacy':
            path = f'instance/{instance}/status'
        else:
            path = 'instance/status'
        return self._request('GET', path)

    def logout(self, *, instance=None):
        if self.provider == 'evolution_go':
            return self._request('DELETE', 'instance/logout')
        return self._request('POST', f'instance/logout/{instance}')

    def get_avatar(self, number: str):
        if self.provider != 'evolution_go':
            return {}
        payload = {'number': str(number), 'preview': False}
        return self._request('POST', 'user/avatar', payload)
