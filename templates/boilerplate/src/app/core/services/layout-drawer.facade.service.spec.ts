import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { LayoutDrawerFacadeService } from './layout-drawer.facade.service';
import { LayoutDrawerService } from './layout-drawer.service';

@Component({ standalone: true, template: '' })
class StubPanel {}

describe('LayoutDrawerFacadeService', () => {
  let facade: LayoutDrawerFacadeService;
  let service: LayoutDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    facade = TestBed.inject(LayoutDrawerFacadeService);
    service = TestBed.inject(LayoutDrawerService);
  });

  it('expone el estado del service subyacente', () => {
    service.open(StubPanel, 'Título');
    expect(facade.isOpen()).toBe(true);
    expect(facade.title()).toBe('Título');
  });

  it('open() delega en el service', () => {
    facade.open(StubPanel, 'Desde la facade', 'settings');
    expect(service.isOpen()).toBe(true);
    expect(service.icon()).toBe('settings');
  });

  it('close() delega en el service', () => {
    facade.open(StubPanel, 'X');
    facade.close();
    expect(service.isOpen()).toBe(false);
  });

  it('setActions() delega en el service', () => {
    facade.open(StubPanel, 'X');
    facade.setActions([{ label: 'A', icon: 'check', callback: () => {} }]);
    expect(service.actions().length).toBe(1);
  });

  it('NO re-expone clear() — es responsabilidad del componente del drawer', () => {
    // El facade es la superficie que ve la UI. clear() destruye la vista y solo
    // debe llamarlo el componente del drawer cuando GSAP terminó la salida.
    // Exponerlo acá invitaría a cualquier componente a matar la animación.
    expect((facade as unknown as { clear?: unknown }).clear).toBeUndefined();
  });
});
