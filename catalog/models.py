import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify


class Service(models.Model):
    class Category(models.TextChoices):
        HAIR = 'HAIR', 'Cabelo'
        BEARD = 'BEARD', 'Barba'
        COMBO = 'COMBO', 'Combo (Cabelo + Barba)'
        AESTHETICS = 'AESTHETICS', 'Estética / Sobrancelha'
        CHEMISTRY = 'CHEMISTRY', 'Química (Alisamento / Coloração / Luzes)'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(max_length=100, verbose_name='Nome do Serviço')
    slug = models.SlugField(unique=True, blank=True)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.HAIR,
        verbose_name='Categoria',
    )
    description = models.TextField(
        blank=True,
        help_text='Descrição do serviço',
        verbose_name='Descrição',
    )
    price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        verbose_name='Preço',
        help_text='Preço do serviço',
    )
    promotion_price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Preencha apenas se o serviço estiver em promoção",
        verbose_name="Preço Promocional",
    )
    duration_minutes = models.PositiveIntegerField(
        default=30,
        help_text='Duração em minutos',
        verbose_name='Duração (minutos)',
    )
    image = models.ImageField(
        upload_to='catalog/images/',
        null=True,
        blank=True,
        verbose_name='Imagem',
        help_text='Imagem do serviço',
    )
    is_featured = models.BooleanField(
        default=False,
        help_text="Marque para destacar este serviço na página inicial",
    )
    display_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'name']
        verbose_name = 'Serviço'
        verbose_name_plural = 'Serviços'

    def clean(self):
        if self.promotion_price and self.promotion_price >= self.price:
            raise ValidationError(
                "O preço promocional deve ser menor que o preço normal."
            )
        if self.duration_minutes is not None and self.duration_minutes < 5:
            raise ValidationError(
                "A duração deve ter pelo menos 5 minutos."
            )

    def save(self, *args, **kwargs):
        self.clean()
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while (
                Service.objects.filter(slug=slug)
                .exclude(pk=self.pk)
                .exists()
            ):
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def effective_price(self):
        """Retorna o preço promocional se ativo, senão o preço padrão."""
        return self.promotion_price if self.promotion_price else self.price

    def __str__(self):
        return (
            f"{self.name} ({self.duration_minutes} min) "
            f"- R${self.effective_price}"
        )


class Product(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(max_length=100, verbose_name='Nome do Produto')
    sku = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        help_text="Código de barras ou código interno opcional",
    )
    description = models.TextField(blank=True)
    cost_price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0.00,
        verbose_name='Preço de Custo (R$)',
    )
    sale_price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        verbose_name='Preço de Venda (R$)',
    )
    stock_quantity = models.IntegerField(
        default=0,
        verbose_name='Estoque Atual',
    )
    min_stock_alert = models.PositiveIntegerField(
        default=2,
        help_text=(
            "Avisa no painel quando o estoque atingir ou ficar "
            "abaixo desta quantidade"
        ),
    )
    image = models.ImageField(
        upload_to='catalog/products/',
        null=True,
        blank=True,
        verbose_name='Imagem',
        help_text='Imagem do produto',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Produto'
        verbose_name_plural = 'Produtos'

    def save(self, *args, **kwargs):
        if not self.sku:
            sku = str(uuid.uuid4()).split('-')[0].upper()
            while (
                Product.objects.filter(sku=sku)
                .exclude(pk=self.pk)
                .exists()
            ):
                sku = str(uuid.uuid4()).split('-')[0].upper()
            self.sku = sku
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.stock_quantity} un) - R${self.sale_price}"
