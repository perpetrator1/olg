from django.urls import path, include

urlpatterns = [
    path('api/federation/', include('federation.urls')),
]
