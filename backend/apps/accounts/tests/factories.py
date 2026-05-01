import factory
from factory.django import DjangoModelFactory
from apps.accounts.models import CustomUser, UserRole


class UserFactory(DjangoModelFactory):
    class Meta:
        model = CustomUser

    email = factory.Sequence(lambda n: f'user{n}@ikibondo.rw')
    full_name = factory.Faker('name')
    role = UserRole.CHW
    phone_number = factory.Faker('phone_number')
    is_active = True

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        manager = cls._get_manager(model_class)
        return manager.create_user(*args, **kwargs)


class NurseFactory(UserFactory):
    role = UserRole.NURSE


class SupervisorFactory(UserFactory):
    role = UserRole.SUPERVISOR


class AdminUserFactory(UserFactory):
    role = UserRole.ADMIN
    is_staff = True
    is_superuser = True
